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
        this.valid = this.startX != this.endX || this.startY != this.endY;
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

        var startCompId = null, endCompId = null;

        // Setup our pin coords
        this.pins.start.x = this.startX;
        this.pins.start.y = this.startY;
        this.pins.end.x = this.endX;
        this.pins.end.y = this.endY;

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

        // Add to component array
        this.placed   = true;
        this.dirty    = true;
        App.components.push(this);

        // If we're an input wire, assign a letter (so the wire can be drawn as
        // "Input A" or "Input F", etc)
        if (this.subtype === 'input') {
            this.letter = App.input;
            App.input = String.fromCharCode(App.input.charCodeAt(0) + 1);
        }

        // Simplify for loops by ordering x,y coords
        var smallX = Math.min(this.startX, this.endX);
        var bigX   = Math.max(this.startX, this.endX);
        var smallY = Math.min(this.startY, this.endY);
        var bigY   = Math.max(this.startY, this.endY);

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
        }
    }

    Wire.prototype.setStartXY = function(x, y) {
        if (x != this.startX) {
            this.startX = x;
            this.dirty  = true;
            this.valid  = true; // Be optimistic
        }

        if (y != this.startY) {
            this.startY = y;
            this.dirty  = true;
            this.valid  = true; // Be optimistic
        }
    }

    Wire.prototype.setEndXY = function(x, y) {
        this.setXY(1, x, y);
    }

    Wire.prototype.draw = function() {
        //console.log('Wire.draw called');

        var context    = App.context.main;
        var wireStartX = this.startX;
        var wireEndX   = this.endX;
        var wireStartY = this.startY;
        var wireEndY   = this.endY;
        var persistent = false;
        var id         = false;

        // Determine the context to draw the component on
        if (this.placed) {
            context = App.context.component;
        }

        // No longer dirty
        this.dirty = false;

        // Instantiate some vars
        var halfSnap = App.actualSnap / 2;
        var xDirection = 0; // 1 = right, -1 = left, 0 = none (equal)
        var yDirection = 0; // 1 = down, -1 = up, 0 = none (equal)
        var componentId = App.nextGroupId;

        // Replace deleted horizontal lines
        if (App.toolState.replaceHorizontalWires != undefined && !this.placed) {
            App.context.component.strokeStyle = '#575252';
            App.context.component.lineWidth = 2;

            for (index in App.toolState.replaceHorizontalWires) {
                var c = App.toolState.replaceHorizontalWires[index];

                App.context.component.beginPath();

                if (App.components[App.grid[c.x + '.' + c.y][App.TYPE_HORIZONTAL_WIRE]].subtype == 'input') {
                    App.context.component.strokeStyle = '#f600ff';
                } else if (App.components[App.grid[c.x + '.' + c.y][App.TYPE_HORIZONTAL_WIRE]].subtype == 'output') {
                    App.context.component.strokeStyle = '#00f0ff';
                } else {
                    App.context.component.strokeStyle = '#575252';
                }

                App.context.component.moveTo(c.x - App.actualSnap, c.y);
                App.context.component.lineTo(c.x + App.actualSnap, c.y);
                App.context.component.stroke();
            }
        }

        App.toolState.replaceHorizontalWires = [];

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
        ////console.log('drawWire persisting: smallX: %d, bigX: %d, smallY: %d, bigY: %d', smallX, bigX, smallY, bigY);
        ////console.log('drawWire: wireStartX: %d, wireStartY: %d, wireEndX: %d, wireEndY: %d', wireStartX, wireStartY, wireEndX, wireEndY);
        ////console.log('X direction: %d, Y direction: %d', xDirection, yDirection);
        context.beginPath();

        // Draw the wire vertically first
        if (wireStartY != wireEndY) {
            context.strokeStyle = '#575252';

            // Look for horizontal wires in our way and redraw them with a bridge
            for (var j = smallY; j <= bigY; j += App.actualSnap) {
                var idx = realWireStartX + '.' + j;

                if (App.hasGridComp(idx, App.TYPE_VERTICAL_WIRE, this.id) && !App.hasGridComp(idx, App.TYPE_WIRE_ENDPOINT, this.id) && !App.hasGridComp(idx, App.TYPE_HORIZONTAL_WIRE, this.id)) {
                    // The above if statement checks if we're in a block with a vertical wire that doesn't also have a
                    // wire endpoint (e.g. its the end of a wire so we can connect to it) or a horizontal wire (its a c
                    // corner)
                    this.valid = false;
                } else if (j != smallY && j != bigY && App.grid[idx] && App.grid[idx][App.TYPE_HORIZONTAL_WIRE] !== undefined && App.grid[idx][App.TYPE_WIRE_ENDPOINT] === undefined) {
                    // Clear that area
                    App.context.component.clearRect(wireStartX - halfSnap, j - halfSnap, App.actualSnap, App.actualSnap);

                    if (App.components[App.grid[idx][App.TYPE_HORIZONTAL_WIRE]].subtype == 'input') {
                        context.strokeStyle = '#f600ff';
                    } else if (App.components[App.grid[idx][App.TYPE_HORIZONTAL_WIRE]].subtype == 'output') {
                        context.strokeStyle = '#00f0ff';
                    } else if (context.strokeStyle != '#575252') {
                        context.strokeStyle = '#575252';
                    }

                    // Draw an arc
                    context.moveTo(wireStartX - halfSnap, j);
                    context.arc(wireStartX, j, halfSnap, Math.PI, 0, false);
                    context.stroke();

                    // If we're not in persistent mode, we need to go back later
                    // and redraw the original horizontal line if we don't keep
                    // the current layout
                    if (!this.placed) {
                        App.toolState.replaceHorizontalWires.push({ x: wireStartX, y: j });
                    }
                } else if (App.gridContainsAnythingExcept(idx, [App.TYPE_HORIZONTAL_WIRE, App.TYPE_WIRE_ENDPOINT, App.TYPE_VERTICAL_WIRE], this.id)) {
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
            for (var j = smallX; j <= bigX; j += App.actualSnap) {
                idx = j + '.' + realWireEndY;

                if (App.hasGridComp(idx, App.TYPE_HORIZONTAL_WIRE, this.id) &&
                    !App.hasGridComp(idx, App.TYPE_WIRE_ENDPOINT, this.id) &&
                    !App.hasGridComp(idx, App.TYPE_VERTICAL_WIRE, this.id) &&
                    !App.hasGridComp(j + '.' + (realWireEndY - App.actualSnap), App.TYPE_VERTICAL_WIRE, this.id)) {
                    // The above if statement checks if we're in a block with a horizontal wire that doesn't also have a
                    // wire endpoint (e.g. its the end of a wire so we can connect to it) or a vertical wire (its a
                    // corner)
                    this.valid = false;
                } else if (j != smallX && j != bigX && App.grid[idx] && App.grid[idx][App.TYPE_VERTICAL_WIRE] !== undefined) {
                    context.lineTo(j - halfSnap, realWireEndY);

                    // Draw an arc
                    context.arc(j, realWireEndY, halfSnap, Math.PI, 0, false);

                    // Move cursor
                    context.moveTo(j + halfSnap, realWireEndY);
                } else if (App.gridContainsAnythingExcept(idx, [App.TYPE_HORIZONTAL_WIRE, App.TYPE_WIRE_ENDPOINT, App.TYPE_VERTICAL_WIRE], this.id)) {
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
        App.drawWireEndpoint(context, realWireStartX, realWireStartY, id);
        App.drawWireEndpoint(context, realWireEndX, realWireEndY, id);

        // Draw label
        if (subtype == 'output') {
            context.font = '10pt Calibri';
            context.textAlign = 'left';
            context.fillText('Out', realWireStartX + 5, realWireStartY + 10);
        } else if (subtype === 'input') {
            context.font = '10pt Calibri';
            context.textAlign = 'left';
            context.fillText('In ' + App.input, realWireStartX + 5, realWireStartY + 10);
        }
    }

    App.registerComponent('Wire', Wire);
})();
