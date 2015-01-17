(function() {
    var Wire = function(attributes) {
        this.id          = attributes.id || -1;
        this.type        = App.TYPE_WIRE;
        this.dirty       = true;
        this.subtype     = attributes.subtype;
        this.startX      = attributes.startX;
        this.startY      = attributes.startY;
        this.endX        = attributes.endX;
        this.endY        = attributes.endY;
        this.placed      = attributes.placed === undefined ? true : attributes.place;
        this.connectable = this.subtype === 'default';
        this.drawNodes   = 2;
        this.redrawTemp  = [];

        // Pins
        this.pins = {
            start: {
                connected_to: [],
                power_sources: [],
                label: 'Start',
                x: 0,
                y: 0
            },
            end: {
                connected_to: [],
                power_sources: [],
                label: 'End',
                x: 0,
                y: 0
            }
        };

        // Is this component currently in a valid state (e.g. can it be placed)
        this.valid = true;
    }

    Wire.prototype.isReceivingPower = function(receivingPower, x, y, sourceId, notifiedBy) {
        var pin;

        for (pin in this.pins) {
            pin = this.pins[pin];

            var index = pin.power_sources.indexOf(sourceId);
            var changed = false;

            if (receivingPower && index === -1) {
                pin.power_sources.push(sourceId);
                changed = true;
            } else if (!receivingPower && index !== -1) {
                pin.power_sources.splice(index, 1);
                changed = true;
            }

            if (changed) {
                for (idx in pin.connected_to) {
                    if (pin.connected_to[idx] !== notifiedBy && pin.connected_to[idx] !== undefined) {
                        App.components[pin.connected_to[idx]].isReceivingPower(receivingPower, pin.x, pin.y, sourceId, this.id);
                    }
                }

                App.dirty.component = true;
            }
        }
    }

    Wire.prototype.connectTo = function(componentId, x, y, notifiedBy) {
        //console.log('Wire.connectTo called, connecting ' + this.id + ' to ' + componentId)

        for (pin in this.pins) {
            if (this.pins[pin].x === x && this.pins[pin].y === y) {
                this.pins[pin].connected_to.push(componentId);
                return;
            }
        }

        this.pins['pin_' + x + '_' + y] = {
            connected_to: [componentId],
            power_sources: [],
            label: 'Pin ' + x + 'x' + y,
            x: x,
            y: y
        }
    }

    Wire.prototype.place = function() {
        if (this.id >= 0) {
            //console.log('Wire.place called on already placed component');
            return false;
        } else {
            this.id = App.components.length;
            //console.log('Wire.place called for component ID#%d', this.id);
        }

        // Important this goes first lol
        App.unplacedComponent = null;

        var startCompId = null, endCompId = null, compIds = null;

        // Setup our pin coords
        this.pins.start.x = this.startX;
        this.pins.start.y = this.startY;
        this.pins.end.x = this.endX;
        this.pins.end.y = this.endY;

        // For nice for loops
        var smallX = Math.min(this.startX, this.endX);
        var bigX   = Math.max(this.startX, this.endX);
        var smallY = Math.min(this.startY, this.endY);
        var bigY   = Math.max(this.startY, this.endY);

        // Are we connected to another line via the start node?
        if (App.hasGridComp(this.startX + '.' + this.startY, App.TYPE_WIRE_ENDPOINT)) {
            startCompId = App.grid[this.startX + '.' + this.startY][App.TYPE_WIRE_ENDPOINT];
        } else if (App.hasGridComp(this.startX + '.' + this.startY, App.TYPE_HORIZONTAL_WIRE)) {
            startCompId = App.grid[this.startX + '.' + this.startY][App.TYPE_HORIZONTAL_WIRE];
        } else if (App.hasGridComp(this.startX + '.' + this.startY, App.TYPE_VERTICAL_WIRE)) {
            startCompId = App.grid[this.startX + '.' + this.startY][App.TYPE_VERTICAL_WIRE];
        }

        // Are we connected to another line via the end node?
        if (App.hasGridComp(this.endX + '.' + this.endY, App.TYPE_WIRE_ENDPOINT)) {
            endCompId = App.grid[this.endX + '.' + this.endY][App.TYPE_WIRE_ENDPOINT];
        } else if (App.hasGridComp(this.endX + '.' + this.endY, App.TYPE_HORIZONTAL_WIRE)) {
            endCompId = App.grid[this.endX + '.' + this.endY][App.TYPE_HORIZONTAL_WIRE];
        } else if (App.hasGridComp(this.endX + '.' + this.endY, App.TYPE_VERTICAL_WIRE)) {
            endCompId = App.grid[this.endX + '.' + this.endY][App.TYPE_VERTICAL_WIRE];
        }

        // Our start pin is connected to another wire
        if (startCompId !== null) {
            Array.prototype.push.apply(this.pins.start.connected_to, startCompId.slice());

            for (var i = 0; i < startCompId.length; i++) {
                App.components[startCompId[i]].connectTo(this.id, this.startX, this.startY);
            }
        }

        // Our start pin is connected to another wire
        if (endCompId !== null) {
            Array.prototype.push.apply(this.pins.end.connected_to, endCompId.slice());

            for (var i = 0; i < endCompId.length; i++) {
                if (endCompId[i] !== this.id) {
                    App.components[endCompId[i]].connectTo(this.id, this.endX, this.endY);
                }
            }
        }

        // Connect to components that we overlapped the endpoints (vertically)
        for (var i = smallY; i < bigY; i += App.actualSnap) {

            if (App.hasGridComp(this.startX + '.' + i, App.TYPE_WIRE_ENDPOINT)) {
                compIds = App.grid[this.startX + '.' + i][App.TYPE_WIRE_ENDPOINT];

                for (var j = 0; j < compIds.length; j++) {
                    if (compIds[j] !== this.id) {
                        this.connectTo(compIds[j], this.startX, i);
                        App.components[compIds[j]].connectTo(this.id, this.startX, i);
                    }
                }
            }
        }

        // Connect to components that we overlapped the endpoints (horizontally)
        for (var i = smallX; i < bigX; i += App.actualSnap) {
            if (App.hasGridComp(i + '.' + this.endY, App.TYPE_WIRE_ENDPOINT)) {
                compIds = App.grid[i + '.' + this.endY][App.TYPE_WIRE_ENDPOINT];
                Array.prototype.push.apply(this.pins.end.connected_to, compIds.slice());

                for (var j = 0; j < compIds.length; j++) {
                    if (compIds[j] !== this.id) {
                        this.connectTo(compIds[j], i, this.endY);
                        App.components[compIds[j]].connectTo(this.id, i, this.endY);
                    }
                }
            }
        }

        // Add to component array
        this.placed     = true;
        this.dirty      = true;
        this.redrawTemp = null;
        App.components.push(this);

        // If we're an input wire, assign a letter (so the wire can be drawn as
        // "Input A" or "Input F", etc)
        if (this.subtype === 'input') {
            this.letter = App.input;
            App.input = String.fromCharCode(App.input.charCodeAt(0) + 1);
        }

        // Add wire endpoints to the grid
        App.addToGrid(this.startX, this.startY, App.TYPE_WIRE_ENDPOINT, this.id);
        App.addToGrid(this.endX, this.endY, App.TYPE_WIRE_ENDPOINT, this.id);

        // Add wiring to the grid (horizontal)
        for (var i = smallX; i < bigX; i += App.actualSnap) {
            App.addToGrid(i, this.endY, App.TYPE_HORIZONTAL_WIRE, this.id);
        }

        // Add wiring to the grid (vertical)
        for (var i = smallY; i < bigY; i += App.actualSnap) {
            App.addToGrid(this.startX, i, App.TYPE_VERTICAL_WIRE, this.id);
        }

        return true;
    }

    Wire.prototype.setXY = function(placed, x, y) {
        if (placed === 0) {
            if (x != this.startX) {
                this.startX = x;
                this.endX   = x;
                this.dirty  = true;
                this.valid  = true; // Be optimistic
            }

            if (y != this.startY) {
                this.startY = y;
                this.endY   = y;
                this.dirty  = true;
                this.valid  = true; // Be optimistic
            }
        } else {
            if (x != this.endX) {
                this.endX  = x;
                this.dirty = true;
                this.valid = true; // Be optimistic
            }

            if (y != this.endY) {
                this.endY  = y;
                this.dirty = true;
                this.valid = true; // Be optimistic
            }

            if (this.startX === this.endX && this.startY === this.endY) {
                this.valid = false;
            } else {
                this.valid = true;
            }
        }
    }

    /**
     * Here be dragons....
     *
     * TODO: Oh for the love of god refactor this
     */
    Wire.prototype.draw = function(partialDraw, pdX, pdY) {
        //console.log('Wire.draw called (component id#%s, dirty: %d)', this.id, this.dirty);

        // Defaults
        partialDraw = partialDraw || false;

        // Variable definitions
        var context    = App.context.main;
        var wireStartX = this.startX;
        var wireEndX   = this.endX;
        var wireStartY = this.startY;
        var wireEndY   = this.endY;
        var persistent = false;
        var id         = false;
        var pdFix      = true;
        var i, j, k, idx, type;

        // Determine the context to draw the component on
        if (this.placed) {
            context = App.context.component;
        }

        // Instantiate some vars
        var halfSnap = App.actualSnap / 2;
        var componentId = App.nextGroupId;

        // Replace deleted horizontal lines
        if (!this.placed && this.redrawTemp) {
            for (i in this.redrawTemp) {
                // Clear that area
                App.context.component.clearRect(this.redrawTemp[i].x - halfSnap, this.redrawTemp[i].y - halfSnap, App.actualSnap, App.actualSnap);
                idx = this.redrawTemp[i].x + '.' + this.redrawTemp[i].y;

                for (type in App.grid[idx]) {
                    for (i in App.grid[idx][type]) {
                        App.components[App.grid[idx][type][i]].draw(true, this.redrawTemp[i].x, this.redrawTemp[i].y);
                    }
                }
            }

            this.redrawTemp.length = 0;
        }

        // We don't really care about start vs end, we care about small vs large
        var smallX = Math.min(wireStartX, wireEndX);
        var smallY = Math.min(wireStartY, wireEndY);
        var bigX = Math.max(wireStartX, wireEndX);
        var bigY = Math.max(wireStartY, wireEndY);

        // Start drawing the wire
        context.beginPath();

        // Draw the wire vertically first
        if (!partialDraw) {
            if (wireStartY != wireEndY) {
                context.strokeStyle = color;
                context.moveTo(wireStartX, smallY);

                // Look for horizontal wires in our way and redraw them with a bridge
                for (var j = smallY; j <= bigY; j += App.actualSnap) {
                    var idx = wireStartX + '.' + j;

                    if (App.hasGridComp(idx, App.TYPE_VERTICAL_WIRE, this.id) && !App.hasGridComp(idx, App.TYPE_WIRE_ENDPOINT, this.id) && !App.hasGridComp(idx, App.TYPE_HORIZONTAL_WIRE, this.id)) {
                        // The above if statement checks if we're in a block with a vertical wire that doesn't also have a
                        // wire endpoint (e.g. its the end of a wire so we can connect to it) or a horizontal wire (its a c
                        // corner)
                        this.valid = false;
                    } else if (
                        j != smallY &&
                        j != bigY &&
                        App.grid[idx] &&
                        App.grid[idx][App.TYPE_HORIZONTAL_WIRE] !== undefined &&
                        App.grid[idx][App.TYPE_WIRE_ENDPOINT] === undefined
                    ) {
                        context.lineTo(wireStartX, j - 1 - (halfSnap * 0.85));

                        // Redraw every component on this square
                        if (!this.placed) {
                            // Clear that area
                            App.context.component.clearRect(wireStartX - halfSnap, j - halfSnap, App.actualSnap, App.actualSnap);

                            for (var type in App.grid[idx]) {
                                for (var i in App.grid[idx][type]) {
                                    App.components[App.grid[idx][type][i]].draw(true, wireStartX, j);
                                }
                            }

                            // If we're not in persistent mode, we need to go back later
                            // and redraw the original horizontal line if we don't keep
                            // the current layout
                            this.redrawTemp.push({ x: wireStartX, y: j });
                        }

                        context.moveTo(wireStartX, j + 3 - (halfSnap * 0.85));
                    } else if (App.gridContainsAnythingExcept(idx, [App.TYPE_HORIZONTAL_WIRE, App.TYPE_WIRE_ENDPOINT, App.TYPE_VERTICAL_WIRE], this.id)) {
                        this.valid = false;
                    }
                }

                context.lineTo(wireStartX, bigY);
            }
        }

        // Draw the wire horizontally now
        if (wireStartX !== wireEndX) {
            var idx, idx2;

            if (wireStartX > wireEndX) {
                context.moveTo(wireEndX, wireEndY);
            } else {
                context.moveTo(wireStartX, wireEndY);
            }

            if (partialDraw) {
                smallX = pdX - App.actualSnap;
                bigX = pdX + App.actualSnap;
            }

            if (this.startX > this.endX) {
                // Wire goes right to left
                idxR = (wireStartX + App.actualSnap) + '.' + wireEndY;
            } else {
                // Wire goes left to right
                idxR = (wireStartX - App.actualSnap) + '.' + wireEndY;
            }

            // Look for any wires running vertically along our horizontal path
            for (var j = smallX; j <= bigX; j += App.actualSnap) {
                idx = j + '.' + wireEndY;

                if (App.hasGridComp(idx, App.TYPE_HORIZONTAL_WIRE, this.id) &&
                    !App.hasGridComp(idx, App.TYPE_WIRE_ENDPOINT, this.id) &&
                    !App.hasGridComp(idx, App.TYPE_VERTICAL_WIRE, this.id) &&
                    !App.hasGridComp(j + '.' + (wireEndY - App.actualSnap), App.TYPE_VERTICAL_WIRE, this.id)) {
                    // The above if statement checks if we're in a block with a horizontal wire that doesn't also have a
                    // wire endpoint (e.g. its the end of a wire so we can connect to it) or a vertical wire (its a
                    // corner)
                    this.valid = false;
                } else if (j === wireStartX && App.hasGridComp(idxR, App.TYPE_HORIZONTAL_WIRE, this.id)) {
                    // This makes connected on a corner invalid
                    this.valid = false;
                } else if (
                    j != smallX &&
                    j != bigX &&
                    App.grid[idx] &&
                    App.grid[idx][App.TYPE_VERTICAL_WIRE] !== undefined &&
                    App.grid[idx][App.TYPE_WIRE_ENDPOINT] === undefined
                ) {
                    context.lineTo(j - (halfSnap * 0.85), wireEndY);

                    // Draw an arc
                    context.arc(j, wireEndY, halfSnap * 0.85, Math.PI, 0, false);

                    // Move cursor
                    context.moveTo(j + (halfSnap * 0.85), wireEndY);
                } else if (
                    App.unplacedComponent &&
                    App.unplacedComponent.type === App.TYPE_WIRE &&
                    App.unplacedComponent.startX === j &&
                    (
                        (App.unplacedComponent.startY < wireEndY && App.unplacedComponent.endY > wireEndY) ||
                        (App.unplacedComponent.startY > wireEndY && App.unplacedComponent.endY < wireEndY)
                    )
                ) {
                    context.moveTo(j - halfSnap, wireEndY);
                    context.lineTo(j - (halfSnap * 0.85), wireEndY);

                    // Draw an arc
                    context.arc(j, wireEndY, halfSnap * 0.85, Math.PI, 0, false);

                    // Move cursor
                    context.moveTo(j + (halfSnap * 0.85), wireEndY);
                    context.lineTo(j + halfSnap, wireEndY);

                    // Don't redraw the proper line
                    pdFix = false;
                } else if (App.gridContainsAnythingExcept(idx, [App.TYPE_HORIZONTAL_WIRE, App.TYPE_WIRE_ENDPOINT, App.TYPE_VERTICAL_WIRE], this.id)) {
                    this.valid = false;
                }
            }

            if (!partialDraw) {
                // Finish drawing the wire
                if (wireStartX > wireEndX) {
                    context.lineTo(wireStartX, wireEndY);
                } else {
                    context.lineTo(wireEndX, wireEndY);
                }
            } else if (pdFix) {
                context.moveTo(pdX - halfSnap, pdY);
                context.lineTo(pdX + halfSnap, pdY);
            }
        }

        // Wire color
        var color = 'white';
        var subtype = 'default';

        if (this.placed) {
            color = '#575252';
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

        // Wires should draw as powered if any pin has power
        for (pin in this.pins) {
            if (this.pins[pin].power_sources.length > 0) {
                color = '#0cff00';
            }
        }

        // Styles that applies to wires AND wire endpoints
        context.strokeStyle = color;
        context.fillStyle = color;
        context.lineWidth = 2;

        // Draw call
        context.stroke();

        // Draw the wiring endpoints
        if (!partialDraw) {
            App.drawWireEndpoint(context, wireStartX, wireStartY, id);
            App.drawWireEndpoint(context, wireEndX, wireEndY, id);
        }

        // Draw label
        if (subtype == 'output') {
            context.font = '10pt Calibri';
            context.textAlign = 'left';
            context.fillText('Out', wireStartX + 5, wireStartY + 10);
        } else if (subtype === 'input') {
            context.font = '10pt Calibri';
            context.textAlign = 'left';
            context.fillText('In ' + App.input, wireStartX + 5, wireStartY + 10);
        }

        // No longer dirty
        this.dirty = false;
    }

    App.registerComponent('Wire', Wire);
})();
