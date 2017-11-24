const Cc = Components.classes;
const Ci = Components.interfaces;

var PrefsUI = {
	
	_beforeInit: true,

	init: function() {
		this._beforeInit = false;
		// populate Left/Middle/Right-click menus
		var popup = document.getElementById("commands-popup");
		for (var i = 0; i < 3; i++) {
			var list = document.getElementsByAttribute("preference", "click." + i)[0];
			list.appendChild(popup.cloneNode(true));
			list.value = list.value;
		}
		this.readAnimatePref("animate_move");
		this.readAnimatePref("animate_zoom");
		this.readButtonsPref();
		this.updateToolbarUI();
		// [Windows] make Aero option selectable on Windows Vista/7
		if (navigator.oscpu.match(/^Windows NT 6\.[01]/))
			document.querySelector("menuitem[value='aero']").disabled = false;
	},

	readStylePref: function() {
		// [Linux][Aero] force to disable popup fade option
		var style = document.getElementById("popup_style").value;
		var check = document.querySelector("[preference='animate_fade']");
		check.disabled = style == "aero" || navigator.platform.startsWith("Linux");
	},

	readAnimatePref: function(aPrefName) {
		var pref  = document.getElementById(aPrefName);
		var check = document.querySelector("[_uigroup='" + aPrefName + "'] > checkbox");
		var scale = document.querySelector("[_uigroup='" + aPrefName + "'] > scale");
		check.checked = pref.value > 0;
		scale.value = (pref.value > 0 ? pref.value : pref.defaultValue) / 100;
		scale.disabled = pref.value == 0;
	},

	writeAnimatePref: function(aPrefName) {
		// ignore scale's change event before onload
		if (this._beforeInit)
			return;
		var pref  = document.getElementById(aPrefName);
		var check = document.querySelector("[_uigroup='" + aPrefName + "'] > checkbox");
		var scale = document.querySelector("[_uigroup='" + aPrefName + "'] > scale");
		pref.value = check.checked ? scale.value * 100 : 0;
		this.readAnimatePref(aPrefName);
	},

	readHoveringPref: function() {
		var enabled = document.getElementById("popup_hovering").value;
		var selector = "[_uigroup='clicks'] *, [_uigroup='toolbar'] *";
		Array.forEach(document.querySelectorAll(selector), function(elt) {
			if (enabled)
				elt.removeAttribute("disabled");
			else
				elt.setAttribute("disabled", "true");
		});
	},

	readButtonsPref: function() {
		var pref = document.getElementById("buttons");
		var buttons = pref.value.split(",");
		var elts = document.querySelectorAll("#tabscope-toolbar > toolbarbutton");
		Array.forEach(elts, function(elt) {
			elt.checked = buttons.indexOf(elt.id.replace(/^tabscope-|-button$/g, "")) >= 0;
		});
	},

	writeButtonsPref: function() {
		var pref = document.getElementById("buttons");
		var buttons = [];
		var elts = document.querySelectorAll("#tabscope-toolbar > toolbarbutton");
		Array.forEach(elts, function(elt) {
			if (elt.checked)
				buttons.push(elt.id.replace(/^tabscope-|-button$/g, ""));
		});
		pref.value = buttons.join(",");
		if (pref.instantApply)
			this.applyPrefsChange();
	},

	updateToolbarUI: function() {
		var display = document.getElementById("toolbar_display").value;
		var toolbar = document.getElementById("tabscope-toolbar");
		toolbar.setAttribute("_display", display.toString());
		var selector = "[_uigroup='buttons'] *";
		Array.forEach(document.querySelectorAll(selector), function(elt) {
			elt.setAttribute("disabled", display == 0);
		});
	},

	applyPrefsChange: function() {
		var winEnum = Cc["@mozilla.org/appshell/window-mediator;1"].
		              getService(Ci.nsIWindowMediator).
		              getEnumerator("navigator:browser");
		while (winEnum.hasMoreElements()) {
			winEnum.getNext().TabScope.loadPrefs();
		}
	},

	openHelpURI: function() {
		var where = document.documentElement.instantApply ? "tab" : "window";
		openUILinkIn("http://www.xuldev.org/tabscope/options.php", where);
	},

	onAeroSelected: function(aText) {
		var ps = Cc["@mozilla.org/embedcomp/prompt-service;1"].getService(Ci.nsIPromptService);
		ps.alert(window, document.title, aText);
	},

};


