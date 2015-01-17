(function (app) {
    var debug = true;

    if (debug) {
        // Use strings for easy reading
        app.TYPE_HORIZONTAL_WIRE = 'wire.horizontal';
        app.TYPE_VERTICAL_WIRE   = 'wire.vertical';
        app.TYPE_WIRE            = 'wire';
        app.TYPE_WIRE_ENDPOINT   = 'wire.endpoint';
        app.TYPE_POWER_SOURCE    = 'node.power_source';
        app.TYPE_TRANSISTOR      = 'node.transistor';
        app.TYPE_GROUND          = 'node.ground';
    } else {
        // Use integers to save ram
        app.TYPE_HORIZONTAL_WIRE = 0;
        app.TYPE_VERTICAL_WIRE   = 1;
        app.TYPE_WIRE            = 2;
        app.TYPE_WIRE_ENDPOINT   = 3;
        app.TYPE_POWER_SOURCE    = 4;
        app.TYPE_TRANSISTOR      = 5;
        app.TYPE_GROUND          = 6;
    }

    // Placeable components
    var Component = {};

    // Tools
    var Tool = {};
    var toolState = {};

    app.Component = Component;

    // Application state
    app.simulate = false;
    app.zoom = 1;
    app.snap = 20;
    app.actualSnap = 20;
    app.mouse = {x: 0, y: 0, draw: true}
    app.input = 'A';

    // Tooling
    app.lastTool = 'Component';
    app.tool     = 'Component';

    // Components
    app.grid        = {};
    app.components  = []; // TODO: Store this as a hash of component ID => array pairs for less operations
    app.nextGroupId = 1;
    app.poweredComponents = {};
    app.canvasEventHandlers = {};

    // Holds the temporary component used when placing a component
    app.unplacedComponent = null;

    // References to elements
    app.container = null;
    app.dirty     = { grid: true, component: true, main: true, sim: true };
    app.canvas    = { grid: null, component: null, main: null, sim: null };
    app.context   = { grid: null, component: null, main: null, sim: null };
    app.width     = 0;
    app.height    = 0;

    app.registerComponent = function(name, component) {
        Component[name] = component;
        console.log('Component registered: %s', name)
    }

    app.registerTool = function(name, tool) {
        Tool[name] = tool;
        console.log('Tool registered: %s', name)
    }

    app.switchTool = function(newTool, options) {
        console.log('Switch tools to ' + newTool)
        options = options || {};

        // Deactivate current tool
        Tool[app.tool].deactivate(toolState);

        // Setup new tool state
        toolState = {};

        // Activate new tool
        Tool[newTool].activate(toolState, options);
        app.tool = newTool;
    }

    //
    app.loadModules = function(moduleNames, cb) {
        var loadCounter = moduleNames.length;
        var script, name;

        for (var i = 0; i < loadCounter; i++) {
            name = moduleNames[i];
            name = name.replace(/([a-z])([A-Z])/g, '$1-$2');

            script = document.createElement('script');
            script.src = 'assets/js' + name.toLowerCase() + '.js';

            script.onload = function() {
                loadCounter--;

                if (loadCounter === 0) {
                    cb();
                }
            };

            document.head.appendChild(script);
            console.log('Loading module %s via %s', moduleNames[i], script.src);
        }
    }

    app.initCanvas = function() {
        // Get everything we need to work with
        app.container         = document.getElementById('app-canvas');
        app.canvas.grid       = document.getElementById('app-canvas-grid');
        app.canvas.component  = document.getElementById('app-canvas-component');
        app.canvas.sim        = document.getElementById('app-canvas-sim');
        app.canvas.main       = document.getElementById('app-canvas-main');
        app.context.grid      = app.canvas.grid.getContext('2d');
        app.context.component = app.canvas.component.getContext('2d');
        app.context.sim       = app.canvas.main.getContext('2d');
        app.context.main      = app.canvas.main.getContext('2d');

        // Setup the canvas size
        app.resizeCanvas();

        // Resize the canvas properly if the window is resized
        window.addEventListener('resize', app.resizeCanvas, false);

        // Activate the default tool
        Tool[app.tool].activate(toolState, {});

        // Mouse events
        app.canvas.main.addEventListener('mousemove', function(evt) {
            var rect = app.canvas.main.getBoundingClientRect();
            var snap = app.actualSnap;
            app.mouse.draw = true;

            // Snap coordinates
            var localX = evt.clientX - rect.left;
            var localY = evt.clientY - rect.top;
            var snapX = Math.round(localX / snap) * snap;
            var snapY = Math.round(localY / snap) * snap;

            if (app.mouse.x != snapX || app.mouse.y != snapY) {
                app.mouse.x = snapX;
                app.mouse.y = snapY;
                app.dirty.main = true;
            }
        }, false);

        app.canvas.main.addEventListener('mouseenter', function(evt) {
            var rect = app.canvas.main.getBoundingClientRect();
            var snap = app.actualSnap;
            app.mouse.draw = true;

            // Snap coordinates
            var localX = evt.clientX - rect.left;
            var localY = evt.clientY - rect.top;
            var snapX = Math.round(localX / snap) * snap;
            var snapY = Math.round(localY / snap) * snap;

            if (app.mouse.x != snapX || app.mouse.y != snapY) {
                app.mouse.x = snapX;
                app.mouse.y = snapY;
                app.dirty.main = true;
            };
        })

        app.canvas.main.addEventListener('mouseout', function(evt) {
            app.mouse.draw = false;
            app.dirty.main = true;
        });

        app.canvas.main.addEventListener('click', function(evt) {
            evt.preventDefault();
            app.dirty.main = true;

            Tool[app.tool].click(toolState, app.mouse.x, app.mouse.y);
        });

        app.canvas.main.addEventListener('contextmenu', function(evt) {
            evt.preventDefault();
            app.dirty.main = true;

            Tool[app.tool].contextmenu(toolState, app.mouse.x, app.mouse.y);
        });

        // Main game loop
        setInterval(app.draw, 20);
    }

    app.resizeCanvas = function() {
        // Get container dimensions
        app.width  = app.container.clientWidth;
        app.height = app.container.clientHeight;

        // Resize the canvas to fit its container
        for (canvas in app.canvas) {
            app.canvas[canvas].width  = app.width;
            app.canvas[canvas].height = app.height;
        }

        // Mark everything as dirty
        for (canvas in app.dirty) {
            app.dirty[canvas] = true;
        }
    }

    app.draw = function() {
        var tempComponentId;

        // Should only get dirty via dev tools
        if (app.dirty.grid) {
            app.dirty.grid = false;

            app.drawGridBackgroundLayer(app.width, app.height);
        }

        // Only redraw if the canvas is dirty (e.g. needs to draw something new)
        if (app.dirty.main) {
            app.dirty.main = false;

            // Clear the canvas
            app.context.main.clearRect(0, 0, app.width, app.height);

            // Draw debug stuff
            app.context.main.font = '10pt Calibri';
            app.context.main.fillStyle = '#747369';
            app.context.main.textAlign = 'right';

            if (app.mouse.draw) {
                // Draw mouse coords
                app.context.main.fillText(app.mouse.x + ', ' + app.mouse.y, app.width - 10, 15);

                // Draw all components under our mouse
                if (app.grid[app.mouse.x + '.' + app.mouse.y]) {
                    var gridComponents = '';

                    for (type in app.grid[app.mouse.x + '.' + app.mouse.y]) {
                        if (gridComponents != '') {
                            gridComponents += ', ';
                        }

                        gridComponents += type + '(' + app.grid[app.mouse.x + '.' + app.mouse.y][type].join(', ') + ')'
                    }

                    app.context.main.fillText(gridComponents, app.width - 10, app.height - 24);
                }
            }

            // Draw the current tool
            app.context.main.fillText(Tool[app.tool].label(toolState), app.width - 10, app.height - 10);

            // Draw the current tool
            if (app.mouse.draw) {
                Tool[app.tool].draw(toolState, app.context.main, app.mouse.x, app.mouse.y);
            }
        }

        if (app.dirty.component) {
            app.dirty.component = false;
            app.context.component.clearRect(0, 0, app.width, app.height);

            // Redraw every component
            for (id in app.components) {
                app.components[id].draw();
            }
        }

        // Go through each component to find dirty ones and allow them to redraw
        for (var idx in app.components) {
            if (app.components[idx].dirty) {
                app.components[idx].draw();
            }
        }

        if (app.mouse.draw) {
            if (app.unplacedComponent !== null && app.unplacedComponent.dirty) {
                app.unplacedComponent.draw();
            }
        }
    }

    app.drawWireEndpoint = function(context, x, y, id, fill) {
        context.beginPath();
        context.arc(x, y, 2, 0, 2 * Math.PI, false);

        var currentComponent = app.grid[x + '.' + y];

        // Current wire endpoint is ON an existing wire so make it a solid color
        if (currentComponent) {
            if (currentComponent[app.TYPE_VERTICAL_WIRE] && currentComponent[app.TYPE_VERTICAL_WIRE][0] != id) {
                context.fill();
            } else if (currentComponent[app.TYPE_HORIZONTAL_WIRE] && currentComponent[app.TYPE_HORIZONTAL_WIRE][0] != id) {
                context.fill();
            } else if (currentComponent[app.TYPE_WIRE_ENDPOINT] && currentComponent[app.TYPE_WIRE_ENDPOINT][0] != id) {
                context.fill();
            }
        }

        if (fill) {
            context.fill();
        }

        context.stroke();
    }

    // Load external components
    app.loadModules([
        '/Components/PowerSource',
        '/Components/Transistor',
        '/Components/Wire',
        '/Tools/Component',
        '/Tools/ComponentTester',
        '/UI/Temp',
        '/Utils/Grid'
    ], app.initCanvas);
})(window.App = {});
