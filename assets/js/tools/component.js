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
        console.log('Tool.ComponentTool deactivated');

        App.unplacedComponent = null;
    }

    ComponentTool.click = function(state, x, y) {
        console.log('Tool.ComponentTool click');

        if (App.unplacedComponent.valid) {
            state.placed++;
        } else {
            state.placed = 0;
        }

        if (App.unplacedComponent.drawNodes === state.placed) {
            App.unplacedComponent.place();
            state.placed = 0;

              // TODO: Do we really want global state?
            var component = ComponentTool.getComponent(state);
            App.unplacedComponent = new component({
                id: -1,
                subtype: state.subtype,
                startX: x,
                startY: y,
                endX: x,
                endY: y,
                placed: false
            });
        }
    }

    ComponentTool.contextmenu = function(state, x, y) {
        console.log('Tool.ComponentTool contextmenu');

        // Right clicking will cancel wire placement
        state.placed = 0;
    }

    ComponentTool.draw = function(state, context, x, y) {
        App.unplacedComponent.setXY(state.placed, x, y);
    }

    App.registerTool('Component', ComponentTool);
})();
