(function() {
    $('#tool-wire').on('click', function(e) {
        e.preventDefault();

        App.lastTool = App.tool;
        App.tool = 'builtin.wire';
    });

    $('#tool-wire-tester').on('click', function(e) {
        e.preventDefault();

        App.lastTool = App.tool;
        App.tool = 'builtin.wire-tester';
        App.toolState = { oldX: -1, oldY: 0 };
    });

    $('#tool-add-power-node').on('click', function(e) {
        e.preventDefault();

        App.lastTool = App.tool;
        App.tool = 'builtin.add-power-node';
        App.toolState = {valid: true};
    });

    $('#tool-add-ground-node').on('click', function(e) {
        e.preventDefault();

        App.lastTool = App.tool;
        App.tool = 'builtin.add-ground-node';
        App.toolState = {valid: true};
    });

    $('#tool-add-input-wire').on('click', function(e) {
        e.preventDefault();

        App.lastTool = App.tool;
        App.tool = 'builtin.wire.input';
        App.toolState = {valid: true};
    });

    $('#tool-add-output-wire').on('click', function(e) {
        e.preventDefault();

        App.lastTool = App.tool;
        App.tool = 'builtin.wire.output';
        App.toolState = {valid: true};
    });

    $('#tool-add-transistor').on('click', function(e) {
        e.preventDefault();

        App.lastTool = App.tool;
        App.tool = 'builtin.add-transistor';
        App.toolState = {valid: true};
    });

    $('#debug-log-components').on('click', function(e) {
        e.preventDefault();

        //console.log(App.components);
    });

    $('#debug-log-grid').on('click', function(e) {
        e.preventDefault();

        //console.log(App.grid);
    });

    $('#debug-clear-components').on('click', function(e) {
        e.preventDefault();

        App.components      = [];
        App.input           = 'A';
        App.grid            = {};
        App.nextGroupId     = 1;
        App.dirty.component = true;
    });

    $('#debug-clear-canvases').on('click', function(e) {
        e.preventDefault();

        for (canvas in App.context) {
            App.context[canvas].clearRect(0, 0, App.width, App.height);
        }
    });

    $('#debug-dirty-canvases').on('click', function(e) {
        e.preventDefault();

        for (canvas in App.dirty) {
            App.dirty[canvas] = true;
        }
    });

    $('#debug-toggle-sim').on('click', function(e) {
        e.preventDefault();

        App.simulate = !App.simulate;

        if (App.simulate) {
            App.tickSimulation();
        } else {
            for (id in App.components) {
                App.components[id].state = 0;
            }
        }
    });
})();