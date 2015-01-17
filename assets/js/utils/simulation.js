(function (app) {
    app.startSimulation = function() {
        app.simulate = true;

        // Give power to all power nodes
        for (var comp in app.components) {
            if (app.components[comp].type === app.TYPE_POWER_SOURCE) {
                app.components[comp].isReceivingPower(true, 0, 0, -2);
            }
        }
    }

    app.stopSimulation = function() {
        app.simulate = false;

        // Remove power from all power nodes
        for (var comp in app.components) {
            if (app.components[comp].type === app.TYPE_POWER_SOURCE) {
                app.components[comp].isReceivingPower(false, 0, 0, -2);
            }
        }
    }
})(window.App);
