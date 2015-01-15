(function (app) {
    var debug = true;

    if (debug) {
        // Use strings for easy reading
        var TYPE_HORIZONTAL_WIRE = 'wire.horizontal';
        var TYPE_VERTICAL_WIRE   = 'wire.vertical';
        var TYPE_WIRE            = 'wire';
        var TYPE_WIRE_ENDPOINT   = 'wire.endpoint';
        var TYPE_POWER_SOURCE    = 'node.power_source';
        var TYPE_TRANSISTOR      = 'node.transistor';
        var TYPE_GROUND          = 'node.ground';
    } else {
        // Use integers to save ram
        var TYPE_HORIZONTAL_WIRE = 0;
        var TYPE_VERTICAL_WIRE   = 1;
        var TYPE_WIRE            = 2;
        var TYPE_WIRE_ENDPOINT   = 3;
        var TYPE_POWER_SOURCE    = 4;
        var TYPE_TRANSISTOR      = 5;
        var TYPE_GROUND          = 6;
    }

    // Application state
    app.simulate = false;
    app.zoom = 1;
    app.snap = 20;
    app.actualSnap = 20;
    app.mouse = {x: 0, y: 0, draw: true}
    app.input = 'A';

    // Tooling
    app.lastTool   = 'builtin.wire';
    app.tool       = 'builtin.wire';
    app.toolActive = false;
    app.toolState  = {};

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

    // Define components
    var Component = {};
    Component.PowerSource = function() {

    }

    Component.Wire = function(attributes) {
        this.id       = attributes.id || 0;
        this.group_id = attributes.group_id || 0;
        this.type     = TYPE_WIRE;
        this.dirty    = true;
        this.subtype  = attributes.subtype;
        this.startX   = attributes.startX;
        this.startY   = attributes.startY;
        this.endX     = attributes.endX;
        this.endY     = attributes.endY;
        this.placed   = attributes.placed === undefined ? true : attributes.place;
        this.pgid     = app.nextGroupId;

        // Is this component currently in a valid state (e.g. can it be placed)
        this.valid = this.startX != this.endX || this.startY != this.endY;
    }

    Component.Wire.prototype.place = function() {
        console.log('Component.Wire.place called');

        if (this.id) {
            console.log(this.id);
            return false;
        }

        this.placed   = true;
        this.id       = app.components.length;
        this.group_id = this.pgid;
        this.dirty    = true;

        if (this.pgid === app.nextGroupId) {
            app.nextGroupId += 1;
            this.pgid = 0;
        }

        app.components.push(this);

        // If we're an input wire, assign a letter (so the wire can be drawn as
        // "Input A" or "Input F", etc)
        if (this.subtype === 'input') {
            this.letter = app.input;
            app.input = String.fromCharCode(app.input.charCodeAt(0) + 1);
        }

        // Simplify for loops by ordering x,y coords
        var smallX = Math.min(this.startX, this.endX);
        var bigX   = Math.max(this.startX, this.endX);
        var smallY = Math.min(this.startY, this.endY);
        var bigY   = Math.max(this.startY, this.endY);

        // Add wiring to the grid (horizontal)
        for (var i = smallX; i < bigX; i += app.actualSnap) {
            if (app.grid[i + '.' + this.endY] == undefined) {
                app.grid[i + '.' + this.endY] = {};
            }

            app.grid[i + '.' + this.endY][TYPE_HORIZONTAL_WIRE] = this.id;
        }

        // Add wiring to the grid (vertical)
        for (var i = smallY; i < bigY; i += app.actualSnap) {
            if (app.grid[this.startX + '.' + i] == undefined) {
                app.grid[this.startX + '.' + i] = {};
            }

            app.grid[this.startX + '.' + i][TYPE_VERTICAL_WIRE] = this.id;
        }

        return true;
    }

    Component.Wire.prototype.setEndXY = function(x, y) {
        if (x != this.endX) {
            this.endX = x;
            this.dirty = true;
            this.valid = true; // Be optimistic
        }

        if (y != this.endY) {
            this.endY = y;
            this.dirty = true;
            this.valid = true; // Be optimistic
        }
    }

    Component.Wire.prototype.draw = function() {
        console.log('Component.Wire.draw called');

        var context    = app.context.main;
        var wireStartX = this.startX;
        var wireEndX   = this.endX;
        var wireStartY = this.startY;
        var wireEndY   = this.endY;
        var persistent = false;
        var id         = false;

        // Determine the context to draw the component on
        if (this.placed) {
            context = app.context.component;
        }

        // No longer dirty
        this.dirty = false;

        // Instantiate some vars
        var halfSnap = app.actualSnap / 2;
        var xDirection = 0; // 1 = right, -1 = left, 0 = none (equal)
        var yDirection = 0; // 1 = down, -1 = up, 0 = none (equal)
        var componentId = app.nextGroupId;

        // Replace deleted horizontal lines
        if (app.toolState.replaceHorizontalWires != undefined && !this.placed) {
            app.context.component.strokeStyle = '#575252';
            app.context.component.lineWidth = 2;

            for (index in app.toolState.replaceHorizontalWires) {
                var c = app.toolState.replaceHorizontalWires[index];

                app.context.component.beginPath();

                if (app.components[app.grid[c.x + '.' + c.y][TYPE_HORIZONTAL_WIRE]].subtype == 'input') {
                    app.context.component.strokeStyle = '#f600ff';
                } else if (app.components[app.grid[c.x + '.' + c.y][TYPE_HORIZONTAL_WIRE]].subtype == 'output') {
                    app.context.component.strokeStyle = '#00f0ff';
                } else {
                    app.context.component.strokeStyle = '#575252';
                }

                app.context.component.moveTo(c.x - app.actualSnap, c.y);
                app.context.component.lineTo(c.x + app.actualSnap, c.y);
                app.context.component.stroke();
            }
        }

        app.toolState.replaceHorizontalWires = [];

        // Save the original arguments
        var realWireStartX = wireStartX;
        var realWireStartY = wireStartY;
        var realWireEndX = wireEndX;
        var realWireEndY = wireEndY;

        // We don't really care about start vs end, we care about small vs large
        var smallX = wireStartX;
        var smallY = wireStartY;
        var bigX = wireEndX;
        var bigY = wireEndY;

        if (wireStartX > wireEndX) {
            smallX = wireEndX;
            bigX = wireStartX;
        }

        if (wireStartY > wireEndY) {
            smallY = wireEndY;
            bigY = wireStartY;
        }

        // We don't really care about start vs end, we care about small vs large
        if (wireStartX > wireEndX) {
            smallX = wireEndX;
            bigX = wireStartX;
        }

        if (wireStartY > wireEndY) {
            smallY = wireEndY;
            bigY = wireStartY;
        }

        // Calculate wire direction
        if (wireEndY > wireStartY) {
            // The start node is closer to the top
            yDirection = 1;
            wireStartY += 3;
        } else if (wireStartY > wireEndY) {
            // The end node is closer to the top
            yDirection = -1;
            wireStartY -= 3;
        }

        if (wireEndX > wireStartX) {
            // The start node is closer to the left
            xDirection = 1;
            wireEndX -= 3;
        } else if (wireStartX > wireEndX) {
            // The end node is closer to the left
            xDirection = -1;
            wireEndX += 3;
        }

        // Straight vertical line
        if (wireStartX === wireEndX) {
            wireEndY += yDirection * -3;
        }

        // Straight horizontal line
        if (wireStartY === wireEndY) {
            wireStartX += xDirection * 3;
        }

        // TODO: Remove the debug statements
        //console.log('drawWire persisting: smallX: %d, bigX: %d, smallY: %d, bigY: %d', smallX, bigX, smallY, bigY);
        //console.log('drawWire: wireStartX: %d, wireStartY: %d, wireEndX: %d, wireEndY: %d', wireStartX, wireStartY, wireEndX, wireEndY);
        //console.log('X direction: %d, Y direction: %d', xDirection, yDirection);
        context.beginPath();

        // Draw the wire vertically first
        if (wireStartY != wireEndY) {
            context.strokeStyle = '#575252';

            // Look for horizontal wires in our way and redraw them with a bridge
            for (var j = smallY; j <= bigY; j += app.actualSnap) {
                var idx = realWireStartX + '.' + j;

                if (app.hasGridComp(idx, TYPE_VERTICAL_WIRE, this.id)) {
                    this.valid = false;
                } else if (j != smallY && j != bigY && app.grid[idx] && app.grid[idx][TYPE_HORIZONTAL_WIRE] !== undefined) {
                    // Clear that area
                    app.context.component.clearRect(wireStartX - halfSnap, j - halfSnap, app.actualSnap, app.actualSnap);

                    if (app.components[app.grid[idx][TYPE_HORIZONTAL_WIRE]].subtype == 'input') {
                        context.strokeStyle = '#f600ff';
                    } else if (app.components[app.grid[idx][TYPE_HORIZONTAL_WIRE]].subtype == 'output') {
                        context.strokeStyle = '#00f0ff';
                    } else if (context.strokeStyle != '#575252') {
                        context.strokeStyle = '#575252';
                    }

                    // Draw an arc
                    console.log('drawing an arc');
                    context.moveTo(wireStartX - halfSnap, j);
                    context.arc(wireStartX, j, halfSnap, Math.PI, 0, false);
                    context.stroke();

                    // If we're not in persistent mode, we need to go back later
                    // and redraw the original horizontal line if we don't keep
                    // the current layout
                    if (!this.placed) {
                        app.toolState.replaceHorizontalWires.push({ x: wireStartX, y: j });
                    }
                } else if (app.gridContainsAnythingExcept(idx, [TYPE_HORIZONTAL_WIRE], this.id)) {
                    this.valid = false;
                }
            }

            context.beginPath();

            context.strokeStyle = color;
            context.moveTo(wireStartX, wireStartY);
            context.lineTo(wireStartX, wireEndY);
        }

        // Draw the wire horizontally now
        if (wireStartX !== wireEndX) {
            var idx, idx2;

            if (wireStartX > wireEndX) {
                context.moveTo(wireEndX, wireEndY);
            } else {
                context.moveTo(wireStartX, wireEndY);
            }

            // Look for any wires running vertically along our horizontal path
            for (var j = smallX; j <= bigX; j += app.actualSnap) {
                idx = j + '.' + realWireEndY;

                if (app.hasGridComp(idx, TYPE_HORIZONTAL_WIRE, this.id)) {
                    this.valid = false;
                } else if (j != smallX && j != bigX && app.grid[idx] && app.grid[idx][TYPE_VERTICAL_WIRE] !== undefined) {
                    context.lineTo(j - halfSnap, realWireEndY);

                    // Draw an arc
                    context.arc(j, realWireEndY, halfSnap, Math.PI, 0, false);

                    // Move cursor
                    context.moveTo(j + halfSnap, realWireEndY);
                } else if (app.gridContainsAnythingExcept(idx, [TYPE_VERTICAL_WIRE], this.id)) {
                    this.valid = false;
                }
            }

            // Finish drawing the wire
            if (wireStartX > wireEndX) {
                context.lineTo(wireStartX, realWireEndY);
            } else {
                context.lineTo(wireEndX, realWireEndY);
            }
        }

        // Wire color
        var color = 'white';
        var subtype = 'default';

        if (this.placed) {
            color = '#575252';
        }

        if (app.simulate && id && app.poweredComponents[app.components[id].group_id]) {
            color = '#0cff00';
        }

        if (!this.placed && !this.valid) {
            color = 'red';
        }

        if (this.subtype && this.subtype == 'tester') {
            color = 'yellow';
            subtype = 'tester';
        } else if (this.subtype && this.subtype == 'input') {
            color = '#f600ff';
            subtype = 'input';
        } else if (this.subtype && this.subtype == 'output') {
            color = '#00f0ff';
            subtype = 'output';
        }

        // Styles that applies to wires AND wire endpoints
        context.strokeStyle = color;
        context.fillStyle = color;
        context.lineWidth = 2;

        // Draw call
        context.stroke();

        // Draw the wiring endpoints
        app.drawWireEndpoint(context, realWireStartX, realWireStartY, id);
        app.drawWireEndpoint(context, realWireEndX, realWireEndY, id);

        // Draw label
        if (subtype == 'output') {
            context.font = '10pt Calibri';
            context.textAlign = 'left';
            context.fillText('Out', realWireStartX + 5, realWireStartY + 10);
        } else if (subtype === 'input') {
            context.font = '10pt Calibri';
            context.textAlign = 'left';
            context.fillText('In ' + app.input, realWireStartX + 5, realWireStartY + 10);
        }

        // Add each wire block as a component
        if (!this.placed) {
            var startCompId = 0, endCompId = 0;

            // Don't merge wires if we're placing input/output wires
            if (!this.subtype || this.subtype === 'default') {
                // Are we connected to another line via the start node?
                if (app.grid[realWireStartX + '.' + realWireStartY] && app.grid[realWireStartX + '.' + realWireStartY][TYPE_HORIZONTAL_WIRE]) {
                    startCompId = app.components[app.grid[realWireStartX + '.' + realWireStartY][TYPE_HORIZONTAL_WIRE]].group_id;
                } else if (app.grid[realWireStartX + '.' + realWireStartY] && app.grid[realWireStartX + '.' + realWireStartY][TYPE_VERTICAL_WIRE]) {
                    startCompId = app.components[app.grid[realWireStartX + '.' + realWireStartY][TYPE_VERTICAL_WIRE]].group_id;
                } else if (app.grid[realWireStartX + '.' + realWireStartY] && app.grid[realWireStartX + '.' + realWireStartY][TYPE_WIRE_ENDPOINT]) {
                    startCompId = app.components[app.grid[realWireStartX + '.' + realWireStartY][TYPE_WIRE_ENDPOINT]].group_id;
                }

                // Are we connected to another line via the end node?
                if (app.grid[realWireEndX + '.' + realWireEndY] && app.grid[realWireEndX + '.' + realWireEndY][TYPE_HORIZONTAL_WIRE]) {
                    endCompId = app.components[app.grid[realWireEndX + '.' + realWireEndY][TYPE_HORIZONTAL_WIRE]].group_id;
                } else if (app.grid[realWireEndX + '.' + realWireEndY] && app.grid[realWireEndX + '.' + realWireEndY][TYPE_VERTICAL_WIRE]) {
                    endCompId = app.components[app.grid[realWireEndX + '.' + realWireEndY][TYPE_VERTICAL_WIRE]].group_id;
                } else if (app.grid[realWireEndX + '.' + realWireEndY] && app.grid[realWireEndX + '.' + realWireEndY][TYPE_WIRE_ENDPOINT]) {
                    endCompId = app.components[app.grid[realWireEndX + '.' + realWireEndY][TYPE_WIRE_ENDPOINT]].group_id;
                }

                if (startCompId > 0 && endCompId > 0 && app.components[startCompId].type == 'wire' && app.components[startCompId].subtype == 'default' && app.components[endCompId].type == 'wire' && app.components[endCompId].subtype == 'default') {
                    // Link all components
                    for (id in app.components) {
                        if (app.components[id] && app.components[id].group_id == endCompId) {
                            app.components[id].group_id = startCompId;
                        }
                    }

                    componentId = startCompId;
                } else if (startCompId > 0 && app.components[startCompId].type == 'wire' && app.components[startCompId].subtype == 'default') {
                    componentId = startCompId;
                } else if (endCompId > 0 && app.components[endCompId].type == 'wire' && app.components[endCompId].subtype == 'default') {
                    componentId = endCompId;
                }
            }
        }
    }

    app.hasGridComp = function(gridIndex, type, componentId) {
        return app.grid[gridIndex] && app.grid[gridIndex][type] !== undefined && app.grid[gridIndex][type] !== componentId;
    }

    app.gridContainsAnythingExcept = function(gridIndex, exclude, componentId) {
        if (!app.grid[gridIndex]) {
            return false;
        }

        for (type in app.grid[gridIndex]) {
            // Contains a component that wasn't in the exclude array and doesn't
            // belong to the given component
            if (exclude.indexOf(type) === -1 && app.grid[gridIndex][type] !== componentId) {
                return true;
            }
        }

        return false;
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

        app.canvas.main.addEventListener('mouseout', function(evt) {
            app.mouse.draw = false;
            app.dirty.main = true;
        });

        app.canvas.main.addEventListener('click', function(evt) {
            if (app.tool === 'builtin.wire' || app.tool === 'builtin.wire.input' || app.tool === 'builtin.wire.output') {
                var subtool = 'default';

                if (app.tool == 'builtin.wire.input') {
                    subtool = 'input';
                } else if (app.tool == 'builtin.wire.output') {
                    subtool = 'output';
                }

                if (app.toolActive) {
                    app.toolActive = false;
                    app.dirty.main = true;

                    if (app.unplacedComponent.valid) {
                        app.unplacedComponent.place();
                    }

                    if (subtool != 'default') {
                        app.tool = app.lastTool;
                        app.lastTool = 'builtin.wire.' + subtool;
                    }

                    app.toolState = {};
                } else {
                    app.toolActive = true;
                    app.toolState.startX = app.mouse.x;
                    app.toolState.startY = app.mouse.y;
                    app.toolState.valid = false;

                    app.unplacedComponent = new Component.Wire({
                        id: 0,
                        group_id: 0,
                        subtype: subtool,
                        startX: app.mouse.x,
                        startY: app.mouse.y,
                        endX: app.mouse.x,
                        endY: app.mouse.y,
                        placed: false
                    })
                }
            } else if (app.tool == 'builtin.add-power-node') {
                app.tool = app.lastTool;
                app.lastTool = 'builtin.add-power-node';
                app.dirty.main = true;

                if (app.toolState.valid) {
                    app.drawPowerNode(app.context.component, 'default', app.mouse.x, app.mouse.y, true);
                }
            } else if (app.tool == 'builtin.add-ground-node') {
                app.tool = app.lastTool;
                app.lastTool = 'builtin.add-ground-node';
                app.dirty.main = true;

                if (app.toolState.valid) {
                    app.drawGroundNode(app.context.component, 'default', app.mouse.x, app.mouse.y, true);
                }
            } else if (app.tool == 'builtin.add-transistor') {
                app.tool = app.lastTool;
                app.lastTool = 'builtin.add-transistor';
                app.dirty.main = true;

                if (app.toolState.valid) {
                    app.drawTransistor(app.context.component, 'default', app.mouse.x, app.mouse.y, true);
                }
            }
        });

        $('#tool-wire').on('click', function(e) {
            e.preventDefault();

            app.lastTool = app.tool;
            app.tool = 'builtin.wire';
        });

        $('#tool-wire-tester').on('click', function(e) {
            e.preventDefault();

            app.lastTool = app.tool;
            app.tool = 'builtin.wire-tester';
        });

        $('#tool-add-power-node').on('click', function(e) {
            e.preventDefault();

            app.lastTool = app.tool;
            app.tool = 'builtin.add-power-node';
            app.toolState = {valid: true};
        });

        $('#tool-add-ground-node').on('click', function(e) {
            e.preventDefault();

            app.lastTool = app.tool;
            app.tool = 'builtin.add-ground-node';
            app.toolState = {valid: true};
        });

        $('#tool-add-input-wire').on('click', function(e) {
            e.preventDefault();

            app.lastTool = app.tool;
            app.tool = 'builtin.wire.input';
            app.toolState = {valid: true};
        });

        $('#tool-add-output-wire').on('click', function(e) {
            e.preventDefault();

            app.lastTool = app.tool;
            app.tool = 'builtin.wire.output';
            app.toolState = {valid: true};
        });

        $('#tool-add-transistor').on('click', function(e) {
            e.preventDefault();

            app.lastTool = app.tool;
            app.tool = 'builtin.add-transistor';
            app.toolState = {valid: true};
        });

        $('#debug-log-components').on('click', function(e) {
            e.preventDefault();

            console.log(app.components);
        });

        $('#debug-log-grid').on('click', function(e) {
            e.preventDefault();

            console.log(app.grid);
        });

        $('#debug-clear-components').on('click', function(e) {
            e.preventDefault();

            app.components      = [];
            app.input           = 'A';
            app.grid            = {};
            app.nextGroupId     = 1;
            app.dirty.component = true;
        });

        $('#debug-clear-canvases').on('click', function(e) {
            e.preventDefault();

            for (canvas in app.context) {
                app.context[canvas].clearRect(0, 0, app.width, app.height);
            }
        });

        $('#debug-dirty-canvases').on('click', function(e) {
            e.preventDefault();

            for (canvas in app.dirty) {
                app.dirty[canvas] = true;
            }
        });

        $('#debug-toggle-sim').on('click', function(e) {
            e.preventDefault();

            app.simulate = !app.simulate;

            if (app.simulate) {
                app.tickSimulation();
            } else {
                for (id in app.components) {
                    app.components[id].state = 0;
                }
            }
        });

        // Main game loop
        setInterval(app.drawFrame, 20);
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

        // Draw the grid background
        app.drawAppBackground(app.width, app.height);
    }

    app.drawFrame = function() {
        // Only redraw if the canvas is dirty (e.g. needs to draw something new)
        if (app.dirty.main) {
            app.dirty.main = false;

            // Clear the canvas
            app.context.main.clearRect(0, 0, app.width, app.height);

            // Draw mouse coords
            if (app.mouse.draw) {
                app.context.main.font = '10pt Calibri';
                app.context.main.fillStyle = '#747369';
                app.context.main.textAlign = 'right';
                app.context.main.fillText(app.mouse.x + ', ' + app.mouse.y, app.width - 10, 15);
            }

            // Draw Tool
            app.context.main.font = '10pt Calibri';
            app.context.main.fillStyle = '#747369';
            app.context.main.textAlign = 'right';
            app.context.main.fillText(app.tool, app.width - 10, app.height - 10);

            // Draw the wire tool
            if (app.mouse.draw && (app.tool === 'builtin.wire' || app.tool === 'builtin.wire.input' || app.tool === 'builtin.wire.output')) {
                if (app.toolState.startX != app.mouse.x || app.toolState.startY != app.mouse.y) {
                    app.toolState.valid = true;
                } else {
                    app.toolState.valid = false;
                }

                var subtool = 'default';

                if (app.tool == 'builtin.wire.input') {
                    subtool = 'input';
                } else if (app.tool == 'builtin.wire.output') {
                    subtool = 'output';
                }

                if (app.toolActive) {
                    // Draw the wire
                    app.unplacedComponent.setEndXY(app.mouse.x, app.mouse.y);
                } else {
                    app.context.main.strokeStyle = 'white';
                    app.context.main.fillStyle = 'white';
                    app.context.main.lineWidth = 2;
                    app.drawWireEndpoint(app.context.main, app.mouse.x, app.mouse.y);
                }
            } else if (app.mouse.draw && app.tool == 'builtin.wire-tester') {
                if (app.grid[app.mouse.x + '.' + app.mouse.y]) {
                    var grid = app.grid[app.mouse.x + '.' + app.mouse.y];
                    var compIdx = 0;

                    if (grid[TYPE_WIRE_ENDPOINT]) {
                        compIdx = grid[TYPE_WIRE_ENDPOINT];
                    } else if (grid[TYPE_HORIZONTAL_WIRE]) {
                        compIdx = grid[TYPE_HORIZONTAL_WIRE];
                    } else if (grid[TYPE_VERTICAL_WIRE]) {
                        compIdx = grid[TYPE_VERTICAL_WIRE];
                    }

                    if (compIdx) {
                        var componentId = app.components[compIdx].group_id;
                        var component = null;

                        // Highlight everything with that component ID
                        for (id in app.components) {
                            if (app.components[id] && app.components[id].group_id == componentId) {
                                component =  app.components[id];
                                Component.Wire.draw(app.context.main, 'tester', component.startX, component.startY, component.endX, component.endY, false, id);
                            }
                        }
                    }
                }
            } else if (app.mouse.draw && app.tool == 'builtin.add-power-node') {
                app.drawPowerNode(app.context.main, 'default', app.mouse.x, app.mouse.y);
            } else if (app.mouse.draw && app.tool == 'builtin.add-ground-node') {
                app.drawGroundNode(app.context.main, 'default', app.mouse.x, app.mouse.y);
            } else if (app.mouse.draw && app.tool == 'builtin.add-transistor') {
                app.drawTransistor(app.context.main, 'tool', app.mouse.x, app.mouse.y);
            }
        }

        if (app.dirty.grid) {
            app.dirty.grid = false;

            app.drawAppBackground(app.width, app.height);
        }

        if (app.dirty.component) {
            app.dirty.component = false;
            app.context.component.clearRect(0, 0, app.width, app.height);

            // Redraw every component
            for (id in app.components) {
                app.components[id].draw();
            }
        }

        if (app.dirty.sim && false) {
            app.dirty.sim = false;
            app.context.sim.clearRect(0, 0, app.width, app.height);
            app.poweredComponents = {};

            app.dirty.component = true;
        }

        // Go through each component to find dirty ones and allow them to redraw
        for (component in app.components) {
            if (component.dirty) {
                component.draw();
            }
        }

        if (app.unplacedComponent !== null && app.unplacedComponent.dirty) {
            app.unplacedComponent.draw();
        }
    }

    app.tickSimulation = function() {
        //app.dirty.sim = true;
        app.context.sim.clearRect(0, 0, app.width, app.height);
        var connectedToPower = [];
        var id = null;

        for (id in app.components) {
            if (app.components[id] && app.components[id].type == TYPE_POWER_SOURCE) {
                app.components[id].state = 1;
                connectedToPower = app.getComponentsConnectedToComponent(id);

                console.log(connectedToPower);

                for (id in connectedToPower) {
                    app.components[id].state = 1;
                    //if (app.components[com])
                }
            }
        }

        if (true || app.dirty.sim) {
            app.dirty.component = true;
        }

        if (app.simulate) {
            setTimeout(app.tickSimulation, 500);
        }
    }

    app.drawComponent = function(context, id, component) {
        if (component && component.type === TYPE_WIRE) {
            Component.Wire.draw(context, component.subtype, component.startX, component.startY, component.endX, component.endY, true, id);
        } else if (component && component.type === TYPE_POWER_SOURCE) {
            app.drawPowerNode(context, 'default', component.x, component.y, true, id);
        } else if (component && component.type === TYPE_GROUND) {
            app.drawGroundNode(context, 'default', component.x, component.y, true, id);
        } else if (component && component.type === TYPE_TRANSISTOR) {
            app.drawTransistor(context, 'default', component.x, component.y, true, id);
        }
    }

    app.drawAppBackground = function(width, height) {
        app.context.grid.beginPath();

        // Draw the background color for the working area
        app.context.grid.fillStyle = '#2d2d2d';
        app.context.grid.fillRect(0, 0, width, height);

        // Calculate the lines in each direction
        var verticalLines = width / app.actualSnap;
        var horizontalLines = height / app.actualSnap;

        // Set the color of the grid lines
        app.context.grid.strokeStyle = '#363636';
        app.context.grid.lineWidth = 1;

        // Draw all horizontal lines in the grid
        for (var i = 1; i < verticalLines; i++) {
            // The extra 0.5 is due to how canvas draws lines
            app.context.grid.moveTo((app.actualSnap * i) + 0.5, 0);
            app.context.grid.lineTo((app.actualSnap * i) + 0.5, height);
        }

        // Draw all vertical lines in the grid
        for (var i = 1; i < verticalLines; i++) {
            // The extra 0.5 is due to how canvas draws lines
            app.context.grid.moveTo(0, (app.actualSnap * i) + 0.5);
            app.context.grid.lineTo(width, (app.actualSnap * i) + 0.5);
        }
        app.context.grid.stroke();
    }

    app.drawWireEndpoint = function(context, x, y, id, fill) {
        context.beginPath();
        context.arc(x, y, 2, 0, 2 * Math.PI, false);

        var currentComponent = app.grid[x + '.' + y];

        // Current wire endpoint is ON an existing wire so make it a solid color
        if (currentComponent) {
            if (currentComponent[TYPE_VERTICAL_WIRE] && currentComponent[TYPE_VERTICAL_WIRE] != id) {
                context.fill();
            } else if (currentComponent[TYPE_HORIZONTAL_WIRE] && currentComponent[TYPE_HORIZONTAL_WIRE] != id) {
                context.fill();
            } else if (currentComponent[TYPE_WIRE_ENDPOINT] && currentComponent[TYPE_WIRE_ENDPOINT] != id) {
                context.fill();
            }
        }

        if (fill) {
            context.fill();
        }

        context.stroke();
    }

    app.drawTransistor = function(context, tool, x, y, persistent, id) {
        var componentId = app.nextGroupId;

        // Wire color
        var color = 'white';

        if (persistent) {
            color = '#9e9e9e';
        }

        if (app.toolActive && !app.toolState.valid) {
            color = 'red';
        }

        if (tool && tool == 'builtin.wire-tester') {
            color = 'yellow';
        }

        // Draw it
        var s = app.actualSnap;
        context.beginPath();

        // Input pin (top)
        context.moveTo(x, y);
        context.lineTo(x, y + (s * 0.5));
        context.lineTo(x - (s * 0.5), y + (s * 0.75));

        // Output pin (bottom)
        context.moveTo(x, y + (s * 2));
        context.lineTo(x, y + (s * 1.5));
        context.lineTo(x - (s * 0.5), y + (s * 1.25));

        // Conductive material (side)
        context.moveTo(x - (s * 0.5), y + (s * 0.6));
        context.lineTo(x - (s * 0.5), y + (s * 1.4));

        // Control pin
        context.moveTo(x - (s * 0.5), y + (s * 1));
        context.lineTo(x - (s * 1) + 3, y + (s * 1));

        // Styles that applies to wires AND wire endpoints
        context.strokeStyle = color;
        context.fillStyle = color;
        context.lineWidth = 2;

        // Draw call
        context.stroke();

        // Wire node
        app.drawWireEndpoint(context, x, y, null, true);
        app.drawWireEndpoint(context, x, y + (app.actualSnap * 2), null, true);
        app.drawWireEndpoint(context, x - (s * 1), y + (s * 1), null, true);

        // Add each block as a component
        if (persistent && !id) {
            // Add this new component
            var id = app.components.length;
            app.components.push({ group_id: app.nextGroupId, type: TYPE_TRANSISTOR, x: x, y: y });

            // Add grid items
            app.addToGrid(x - app.actualSnap * 1, y, TYPE_TRANSISTOR, id);
            app.addToGrid(x - app.actualSnap * 0, y, TYPE_TRANSISTOR, id);

            app.addToGrid(x - app.actualSnap * 1, y + app.actualSnap, TYPE_TRANSISTOR, id);
            app.addToGrid(x - app.actualSnap * 0, y + app.actualSnap, TYPE_TRANSISTOR, id);

            app.addToGrid(x, y, TYPE_WIRE_ENDPOINT, id);
            app.addToGrid(x, y + (app.actualSnap * 2), TYPE_WIRE_ENDPOINT, id);
            app.addToGrid(x - (s * 1), y + (s * 1), TYPE_WIRE_ENDPOINT, id);

            // Only increment the global component ID if we didn't re-use an
            // existing component ID (e.g. extending a wire)
            if (app.nextGroupId == componentId) {
                app.nextGroupId++;
            }

            if (app.simulate) {
                app.dirty.sim = true;
            }
        }
    }

    app.drawGroundNode = function(context, tool, x, y, persistent, id) {
        var componentId = app.nextGroupId;

        // Wire color
        var color = 'white';

        if (persistent) {
            color = '#9e9e9e';
        }

        if (app.toolActive && !app.toolState.valid) {
            color = 'red';
        }

        if (app.simulate && id && app.poweredComponents[id]) {
            color = '#0cff00';
        }

        // Draw it
        var a = app.actualSnap;
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x, y + a);

        context.moveTo(x - (a * 1), y + a);
        context.lineTo(x + (a * 1), y + a);

        context.moveTo(x - (a * 0.7), y + (a * 1.3));
        context.lineTo(x + (a * 0.7), y + (a * 1.3));

        context.moveTo(x - (a * 0.35), y + (a * 1.6));
        context.lineTo(x + (a * 0.35), y + (a * 1.6));

        // Styles that applies to wires AND wire endpoints
        context.strokeStyle = color;
        context.fillStyle = color;
        context.lineWidth = 2;

        // Draw call
        context.stroke();

        // Wire node
        app.drawWireEndpoint(context, x, y, null, true);

        // Add each block as a component
        if (persistent && !id) {
            // Add this new component
            var id = app.components.length;
            app.components.push({ group_id: app.nextGroupId, type: TYPE_GROUND, x: x, y: y });

            // Add grid items
            app.addToGrid(x - app.actualSnap, y, TYPE_GROUND, id);
            app.addToGrid(x + app.actualSnap, y, TYPE_GROUND, id);
            app.addToGrid(x, y, TYPE_GROUND, id);
            app.addToGrid(x - app.actualSnap, y + app.actualSnap, TYPE_GROUND, id);
            app.addToGrid(x + app.actualSnap, y + app.actualSnap, TYPE_GROUND, id);
            app.addToGrid(x, y + app.actualSnap, TYPE_GROUND, id);
            app.addToGrid(x, y, TYPE_WIRE_ENDPOINT, id);

            // Only increment the global component ID if we didn't re-use an
            // existing component ID (e.g. extending a wire)
            if (app.nextGroupId == componentId) {
                app.nextGroupId++;
            }

            if (app.simulate) {
                app.dirty.sim = true;
            }
        }
    }

    app.getComponentsConnectedToComponent = function(componentId) {
        var component = app.components[componentId];
        var connected = [];

        if (component.type === TYPE_POWER_SOURCE) {
            var x = component.x + (app.actualSnap * 2);
            var y = component.y + (app.actualSnap * 2);

            // Look for components connected to the power source
            for (type in app.grid[x + '.' + y]) {
                if (type !== TYPE_POWER_SOURCE && type !== TYPE_WIRE_ENDPOINT && connected.indexOf(app.grid[x + '.' + y][type]) < 0) {
                    connected.push(app.grid[x + '.' + y][type]);
                }
            }
        }

        return connected;
    }

    app.drawPowerNode = function(context, tool, x, y, persistent, id) {
        var componentId = app.nextGroupId;

        // Wire color
        var color = 'white';

        if (persistent) {
            color = '#9e9e9e';
        }

        if (app.toolActive && !app.toolState.valid) {
            color = 'red';
        }

        if (app.simulate) {
            color = '#0cff00';
        }

        // Draw it
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x + (app.actualSnap * 4), y);
        context.moveTo(x, y + (app.actualSnap / 2));
        context.lineTo(x + (app.actualSnap * 4), y + (app.actualSnap / 2));
        context.lineTo(x + (app.actualSnap * 2), y + (app.actualSnap / 2));
        context.lineTo(x + (app.actualSnap * 2), y + (app.actualSnap * 2));

        // Styles that applies to wires AND wire endpoints
        context.strokeStyle = color;
        context.fillStyle = color;
        context.lineWidth = 2;

        // Draw call
        context.stroke();

        // Wire node
        app.drawWireEndpoint(context, x + (app.actualSnap * 2), y + (app.actualSnap * 2), null, true);

        // Add each block as a component
        if (persistent && !id) {
            // Add this new component
            var id = app.components.length;
            app.components.push({ group_id: app.nextGroupId, type: TYPE_POWER_SOURCE, x: x, y: y });

            // Add grid items
            app.addToGrid(x + app.actualSnap * 0, y, TYPE_POWER_SOURCE, id);
            app.addToGrid(x + app.actualSnap * 1, y, TYPE_POWER_SOURCE, id);
            app.addToGrid(x + app.actualSnap * 2, y, TYPE_POWER_SOURCE, id);
            app.addToGrid(x + app.actualSnap * 3, y, TYPE_POWER_SOURCE, id);
            app.addToGrid(x + app.actualSnap * 4, y, TYPE_POWER_SOURCE, id);
            app.addToGrid(x + app.actualSnap * 1, y + app.actualSnap, TYPE_POWER_SOURCE, id);
            app.addToGrid(x + app.actualSnap * 2, y + app.actualSnap, TYPE_POWER_SOURCE, id);
            app.addToGrid(x + app.actualSnap * 2, y + app.actualSnap * 2, TYPE_WIRE_ENDPOINT, id);

            // Only increment the global component ID if we didn't re-use an
            // existing component ID (e.g. extending a wire)
            if (app.nextGroupId == componentId) {
                app.nextGroupId++;
            }

            if (app.simulate) {
                app.dirty.sim = true;
            }
        }
    }

    app.addToGrid = function(x, y, type, componentId) {
        if (app.grid[x + '.' + y] == undefined) {
            app.grid[x + '.' + y] = {};
        }

        app.grid[x + '.' + y][type] = componentId;
    }

    $(app.initCanvas);
})({});

//$('#app-canvas-main')
