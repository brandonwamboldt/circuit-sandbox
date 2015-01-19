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

        state.oldX = -1;
        state.oldY = -1;
        state.powered = [];
    }

    ComponentTester.deactivate = function(state) {
        console.log('Tool.ComponentTester deactivated');
    }

    ComponentTester.click = function(state, x, y) {
        console.log('Tool.ComponentTester click');

        if (App.grid[x + '.' + y]) {
            // Toggle component power on this grid
            for (type in App.grid[x + '.' + y]) {
                for (idx in App.grid[x + '.' + y][type]) {
                    tempComponentId = App.grid[x + '.' + y][type][idx];

                    var index = state.powered.indexOf(tempComponentId);

                    if (index === -1) {
                        App.components[tempComponentId].isReceivingPower(true, x, y, -1001);
                        state.powered.push(tempComponentId);
                    } else {
                        App.components[tempComponentId].isReceivingPower(false, x, y, -1001);
                        state.powered.splice(index, 1);
                    }
                }
            }

        }
    }

    ComponentTester.contextmenu = function(state, x, y) {
        console.log('Tool.ComponentTester contextmenu');
    }

    ComponentTester.draw = function(state, context, x, y) {
        var type, idx, tempComponentId;

        if (x != state.oldX || y != state.oldY) {
            if (App.grid[state.oldX + '.' + state.oldY]) {
                // Remove power from every item on this grid square power
                for (type in App.grid[state.oldX + '.' + state.oldY]) {
                    for (idx in App.grid[state.oldX + '.' + state.oldY][type]) {
                        tempComponentId = App.grid[state.oldX + '.' + state.oldY][type][idx];
                        App.components[tempComponentId].isReceivingPower(false, state.oldX, state.oldY, -1);
                    }
                }
            }
        }

        if (App.grid[x + '.' + y]) {
            // Give every item on this grid square power
            for (type in App.grid[x + '.' + y]) {
                for (idx in App.grid[x + '.' + y][type]) {
                    tempComponentId = App.grid[x + '.' + y][type][idx];
                    App.components[tempComponentId].isReceivingPower(true, x, y, -1);
                }
            }
        }

        state.oldX = x;
        state.oldY = y;
    }

    App.registerTool('ComponentTester', ComponentTester);
})();
