var TabScope = {

	// xul:panel element
	popup: null,

	// xul:tab element which mouse pointer currently points to
	_tab: null,

	// timer id to open popup with delay
	_timerId: null,

	// nsITimer instance to update preview and popup position
	_timer: null,

	// flag indicates to require updating preview
	_shouldUpdatePreview: false,

	// nsIPrefBranch
	_branch: null,

	init: function() {
		this.popup = document.getElementById("tabscope-popup");
		this._branch = Services.prefs.getBranch("extensions.tabscope.");
		// disable default tooltip of tabs
		gBrowser.mTabContainer.tooltip = null;
		gBrowser.mTabContainer.mTabstrip.addEventListener("mouseover", this, false);
		gBrowser.mTabContainer.mTabstrip.addEventListener("mousemove", this, false);
		gBrowser.mTabContainer.mTabstrip.addEventListener("mouseout", this, false);
		gBrowser.mTabContainer.addEventListener("TabSelect", this, false);
		gBrowser.mTabContainer.addEventListener("TabClose", this, false);
		gBrowser.mTabContainer.addEventListener("draggesture", this, false);
	},

	uninit: function() {
		this._cancelDelayedOpen();
		NS_ASSERT(this._timer === null, "timer is not cancelled.");
		gBrowser.mTabContainer.removeEventListener("TabSelect", this, false);
		gBrowser.mTabContainer.removeEventListener("TabClose", this, false);
		gBrowser.mTabContainer.removeEventListener("draggesture", this, false);
		gBrowser.mTabContainer.mTabstrip.removeEventListener("mouseover", this, false);
		gBrowser.mTabContainer.mTabstrip.removeEventListener("mousemove", this, false);
		gBrowser.mTabContainer.mTabstrip.removeEventListener("mouseout", this, false);
		this._branch = null;
		this.popup = null;
		this._tab = null;
	},

	handleEvent: function(event) {
//		var rel = event.relatedTarget ? event.relatedTarget.localName : "null";
//		this.log([event.type, event.target.localName, rel].join("\t"));
		switch (event.type) {
			case "mouseover": 
				// when mouse pointer moves inside a tab...
				// when hovering on tab strip...
				// (includes outside corner edge of a tab, new tab button and tab scroller)
				if (event.target == this._tab || event.target.localName != "tab")
					// do nothing, keep popup open if it is opened
					return;
				// when mouse pointer moves from one tab to another before popup will open...
				// cancel opening popup and restart timer in the following process
				this._cancelDelayedOpen();
				if (!this._tab) {
					// when hovering on a tab...
					// popup is currently closed, so open it with delay
					this._tab = event.target;
					var callback = function(self) { self._delayedOpenPopup(); };
					var delay = this._branch.getIntPref("popup_delay");
					this._timerId = window.setTimeout(callback, delay, this);
					this.log("--- start timer (" + this._timerId + ")");
				}
				else {
					// when mouse pointer moves from one tab to another...
					// popup is already opened, so move it now
					this._tab.linkedBrowser.removeEventListener("MozAfterPaint", this, false);
					this._tab = event.target;
					this._tab.linkedBrowser.addEventListener("MozAfterPaint", this, false);
					this._shouldUpdatePreview = false;
					this._adjustPopupPosition(true);
					this._updatePreview();
				}
				break;
			case "mousemove": 
				if (!this._timerId)
					return;
				// if before timer callback, cancel and start it again
				this._cancelDelayedOpen();
				this._tab = event.target;
				var callback = function(self) { self._delayedOpenPopup(); };
				var delay = this._branch.getIntPref("popup_delay");
				this._timerId = window.setTimeout(callback, delay, this);
				this.log("--- start timer again (" + this._timerId + ")");
				break;
			case "mouseout": 
				// don't handle events on non-tab elements e.g. arrowscrollbox
				if (!this._tab)
					return;
				var box = this._tab.boxObject;
				// if tabs are arranged vertically...
				if (gBrowser.mTabContainer.orient == "vertical") {
					// when mouse pointer moves inside vertical band-like area containing tabs...
					if (box.screenX <= event.screenX && event.screenX < box.screenX + box.width)
						// do nothing, keep popup open
						return;
				}
				// if tabs are arranged horizontally...
				else {
					// when mouse pointer moves inside horizontal band-like area containing tabs...
					if (box.screenY <= event.screenY && event.screenY < box.screenY + box.height)
						// do nothing, keep popup open
						return;
				}
				// since popup boxObject holds its size and position even if it is closed,
				// should test with popup boxObject only if popup is open
				if (this._branch.getBoolPref("hovering") && this.popup.state == "open") {
					// when mouse pointer is hovering over popup...
					box = this.popup.boxObject;
					if (box.screenX <= event.screenX && event.screenX < box.screenX + box.width && 
					    box.screenY <= event.screenY && event.screenY < box.screenY + box.height)
						// do nothing, keep popup open
						return;
				}
				// otherwise...
				this._cancelDelayedOpen();
				// close popup if it is opened
				this.popup.hidePopup();
				break;
			case "popupshowing": 
				this.log("open popup");
				this._tab.linkedBrowser.addEventListener("MozAfterPaint", this, false);
				this._shouldUpdatePreview = false;
				this._timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
				this._timer.initWithCallback(this, 500, Ci.nsITimer.TYPE_REPEATING_SLACK);
				this._updatePreview();
				break;
			case "popuphiding": 
				this.log("close popup");
				this._tab.linkedBrowser.removeEventListener("MozAfterPaint", this, false);
				this._timer.cancel();
				this._timer = null;
				this._resetPreview();
				this.popup.removeAttribute("style");
				this._tab = null;
				break;
			case "MozAfterPaint": 
				this._shouldUpdatePreview = true;
				break;
			case "TabSelect": 
			case "TabClose": 
			case "draggesture": 
				if (event.target != this._tab)
					return;
				// when selecting / closing / dragging the current pointed tab...
				this._cancelDelayedOpen();
				this.popup.hidePopup();
				break;
		}
	},

	_delayedOpenPopup: function() {
		// if mouse pointer moves outside tab before callback...
		// if any other popup e.g. tab context menu is opened...
		if (document.querySelector("tab:hover") != this._tab || document.popupNode) {
			// don't open popup
			this._cancelDelayedOpen();
			return;
		}
		this._timerId = null;
		this._adjustPopupPosition(false);
		// [Mac][Linux] don't eat clicks while popup is open
		this.popup.popupBoxObject.setConsumeRollupEvent(Ci.nsIPopupBoxObject.ROLLUP_NO_CONSUME);
		this.popup.openPopupAtScreen(0, 0, false);
	},

	_cancelDelayedOpen: function() {
		if (!this._timerId)
			return;
		this.log("--- cancel timer (" + this._timerId + ")");
		window.clearTimeout(this._timerId);
		this._timerId = null;
		this._tab = null;
	},

	_adjustPopupPosition: function(aAnimate) {
		var box = this._tab.boxObject;
		var x, y;
		switch (this._branch.getIntPref("popup_alignment")) {
			case 2: x = box.screenX; y = box.screenY + box.height; break;
			case 4: y = box.screenY; x = box.screenX + box.width;  break;
		}
		// correct position to avoid popup auto-position
		x = Math.max(x, 0);
		y = Math.max(y, 0);
		var lastX = parseInt(this.popup.style.marginLeft || 0);
		var lastY = parseInt(this.popup.style.marginTop  || 0);
		if (x == lastX && y == lastY)
			// no need to change popup position
			return;
		// XXX to fix popup flicker problem when transition starts just after transtion ends...
		// 1) add extremely small randomness to duration value
		// 2) calculate duration value with getComputedStyle
		var duration = 0;
		if (aAnimate) {
			var delta = Math.max(Math.abs(x - lastX), Math.abs(y - lastY));
			duration = delta * this._branch.getIntPref("animate") / 1000;
			if (duration > 0)
				duration = Math.max(0.2, duration) + Math.random() * 0.001;
		}
		this.popup.style.MozTransitionDuration = duration.toString() + "s";
		window.getComputedStyle(this.popup, null).MozTransitionDuration;
		this.popup.style.marginLeft = x.toString() + "px";
		this.popup.style.marginTop  = y.toString() + "px";
		this.log("move popup (" + lastX + ", " + lastY + ") => (" + x + ", " + y + ") / " + duration);
	},

	_updatePreview: function() {
		this.log("update preview");
		var canvas = document.getElementById("tabscope-canvas");
		canvas.width = this._branch.getIntPref("preview_width");
		canvas.height = Math.floor(canvas.width / 4 * 3);
		var win = this._tab.linkedBrowser.contentWindow;
		var w = win.innerWidth;
		var scale = canvas.width / w;
		var h = canvas.height / scale;
		var ctx = canvas.getContext("2d");
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.save();
		ctx.scale(scale, scale);
		ctx.drawWindow(win, win.scrollX, win.scrollY, w, h, "rgb(255,255,255)");
		ctx.restore();
	},

	_resetPreview: function() {
		var canvas = document.getElementById("tabscope-canvas");
		var ctx = canvas.getContext("2d");
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		canvas.width = 0;
		canvas.height = 0;
	},

	notify: function(aTimer) {
		// check mouse pointer is hovering over tab, otherwise close popup
		if (document.querySelector("tab:hover") != this._tab && 
		    document.querySelector("panel:hover") != this.popup) {
			this.log("*** close popup with delay");
			this.popup.hidePopup();
			return;
		}
		if (this._shouldUpdatePreview) {
			this._shouldUpdatePreview = false;
			this._updatePreview();
		}
		this._adjustPopupPosition(true);
	},

	log: function(aText) {
		dump("tabscope> " + aText + "\n");
	},

};


window.addEventListener("load", function() { TabScope.init(); }, false);
window.addEventListener("unload", function() { TabScope.uninit(); }, false);


