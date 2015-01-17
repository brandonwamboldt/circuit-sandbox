(function() {
    var ComponentTool = function(attributes) {

    }

    ComponentTool.activate = function(state, options) {
    	state.active  = false;
    	state.startX  = 0;
    	state.startY  = 0;
    	state.type    = options.type || App.TYPE_WIRE;
    	state.subtype = options.subtype || 'default';
    }

    ComponentTool.deactivate = function(state) {

    }

    ComponentTool.draw = function(state, context, x, y) {
        if (state.active) {
            // Draw the wire
            app.unplacedComponent.setEndXY(app.mouse.x, app.mouse.y);
        } else {
            context.strokeStyle = 'white';
            context.fillStyle = 'white';
            context.lineWidth = 2;
            App.drawWireEndpoint(context, x, y);
        }
    }

    App.registerTool('Component', ComponentTool);
})();
