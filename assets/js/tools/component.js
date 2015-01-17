(function() {
    var ComponentTool = function(attributes) {

    }

    ComponentTool.label = function(state) {
        return 'Component.' + state.type;
    }

    ComponentTool.getComponent = function(state) {
        if (state.type === App.TYPE_WIRE) {
            return App.Component.Wire;
        }
    }

    ComponentTool.activate = function(state, options) {
        console.log('Tool.ComponentTool activated');
        state.active  = false;
        state.startX  = 0;
        state.startY  = 0;
        state.type    = options.type || App.TYPE_WIRE;
        state.subtype = options.subtype || 'default';
        state.placed  = 0;

        // TODO: Do we really want global state?
        var component = ComponentTool.getComponent(state);
        App.unplacedComponent = new component({
            id: -1,
            subtype: state.subtype,
            startX: 0,
            startY: 0,
            endX: 0,
            endY: 0,
            placed: false
        });
    }

    ComponentTool.deactivate = function(state) {
        App.unplacedComponent = null;
    }

    ComponentTool.click = function(state, x, y) {
        if (state.active) {

        } else {
            state.active = true;
            state.startX = x;
            state.startY = y;

            if (App.unplacedComponent.drawNodes === 1) {
                App.unplacedComponent.place();
            }
        }
    }

    ComponentTool.draw = function(state, context, x, y) {
        if (state.active) {
            // Draw the wire
            //app.unplacedComponent.setEndXY(app.mouse.x, app.mouse.y);
        } else {
            //context.strokeStyle = 'white';
            //context.fillStyle = 'white';
            //context.lineWidth = 2;
            //App.drawWireEndpoint(context, x, y);
            App.unplacedComponent.setXY(state.placed, x, y);
        }
    }

    App.registerTool('Component', ComponentTool);
})();
