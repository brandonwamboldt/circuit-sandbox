(function() {
    var ComponentTester = function(attributes) {

    }

    ComponentTester.label = function(state) {
        return 'Component Tester';
    }

    ComponentTester.getComponent = function(state) {
        if (state.type === App.TYPE_WIRE) {
            return App.Component.Wire;
        }
    }

    ComponentTester.activate = function(state, options) {
        console.log('Tool.ComponentTester activated');
    }

    ComponentTester.deactivate = function(state) {
        console.log('Tool.ComponentTester deactivated');
    }

    ComponentTester.click = function(state, x, y) {
        console.log('Tool.ComponentTester click');
    }

    ComponentTester.contextmenu = function(state, x, y) {
        console.log('Tool.ComponentTester contextmenu');
    }

    ComponentTester.draw = function(state, context, x, y) {

    }

    App.registerTool('ComponentTester', ComponentTester);
})();
