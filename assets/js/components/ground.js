(function() {
    var Ground = function(attributes) {
        this.id          = attributes.id || -1;
        this.type        = App.TYPE_GROUND;
        this.dirty       = true;
        this.x           = attributes.x;
        this.y           = attributes.y;
        this.placed      = attributes.placed === undefined ? true : attributes.place;
        this.connectable = true;
        this.drawNodes   = 1;

        // Pins
        this.pins = {
            input: {
                connected_to: [],
                powered: false,
                label: 'Ground',
                x: 0,
                y: 0
            }
        };

        // Is this component currently in a valid state (e.g. can it be placed)
        this.valid = true;
    }

    Ground.prototype.isReceivingPower = function(receivingPower, x, y, sourceId, notifiedBy) {
        var pin;

        for (pin in this.pins) {
            pin = this.pins[pin];

            if ((!pin.powered && receivingPower) || (pin.powered && !receivingPower)) {
                pin.powered = receivingPower;

                for (idx in pin.connected_to) {
                    if (pin.connected_to[idx] !== undefined) {
                        App.components[pin.connected_to[idx]].isReceivingGround(receivingPower, pin.x, pin.y, this.id, this.id);
                    }
                }

                App.dirty.component = true;
            }
        }
    }

    Ground.prototype.isReceivingGround = function() {
        return true;
    }

    Ground.prototype.connectTo = function(componentId, x, y, notifiedBy) {
        //console.log('Ground.connectTo called, connecting ' + this.id + ' to ' + componentId)

        for (pin in this.pins) {
            if (this.pins[pin].x === x && this.pins[pin].y === y) {
                this.pins[pin].connected_to.push(componentId);
                return;
            }
        }
    }

    Ground.prototype.setXY = function(placed, x, y) {
        if (x != this.x) {
            this.x     = x;
            this.dirty = true;
            this.valid = true; // Be optimistic
        }

        if (y != this.y) {
            this.y     = y;
            this.dirty = true;
            this.valid = true; // Be optimistic
        }
    }

    Ground.prototype.place = function() {
        if (this.id >= 0) {
            //console.log('Ground.place called on already placed component');
            return false;
        } else {
            this.id = App.components.length;
            //console.log('Ground.place called for component ID#%d', this.id);
        }

        // Important this goes first lol
        App.unplacedComponent = null;

        var compIds = null, pin = null;

        // Setup our pin coords
        this.pins.input.x = this.x;
        this.pins.input.y = this.y;

        // Are any of our pins connected to something
        for (pin in this.pins) {
            pin = this.pins[pin];
            compIds = null

            if (App.hasGridComp(pin.x + '.' + pin.y, App.TYPE_WIRE_ENDPOINT)) {
                compIds = App.grid[pin.x + '.' + pin.y][App.TYPE_WIRE_ENDPOINT];
            } else if (App.hasGridComp(pin.x + '.' + pin.y, App.TYPE_HORIZONTAL_WIRE)) {
                compIds = App.grid[pin.x + '.' + pin.y][App.TYPE_HORIZONTAL_WIRE];
            } else if (App.hasGridComp(pin.x + '.' + pin.y, App.TYPE_VERTICAL_WIRE)) {
                compIds = App.grid[pin.x + '.' + pin.y][App.TYPE_VERTICAL_WIRE];
            }

            // Our pin is connected to another component
            if (compIds !== null) {
                Array.prototype.push.apply(pin.connected_to, compIds.slice());

                for (var i = 0; i < compIds.length; i++) {
                    App.components[compIds[i]].connectTo(this.id, pin.x, pin.y);
                }
            }
        }

        // Add to component array
        this.placed = true;
        this.dirty  = true;
        App.components.push(this);

        // Add wire endpoints to the grid
        for (pin in this.pins) {
            App.addToGrid(this.pins[pin].x, this.pins[pin].y, App.TYPE_WIRE_ENDPOINT, this.id);
        }

        // Add the item itself to the grid
        App.addToGrid(this.x - App.actualSnap, this.y, App.TYPE_GROUND, this.id);
        App.addToGrid(this.x + App.actualSnap, this.y, App.TYPE_GROUND, this.id);

        App.addToGrid(this.x - App.actualSnap, this.y + App.actualSnap, App.TYPE_GROUND, this.id);
        App.addToGrid(this.x, this.y + App.actualSnap, App.TYPE_GROUND, this.id);
        App.addToGrid(this.x + App.actualSnap, this.y + App.actualSnap, App.TYPE_GROUND, this.id);

        return true;
    }

    Ground.prototype.draw = function() {
        context = App.context.main;

        // Determine the context to draw the component on
        if (this.placed) {
            context = App.context.component;
        }

        // Check if any of the grid squares we occupy are already occupied
        if (App.gridContainsAnything(this.x - App.actualSnap, this.y, this.id)) {
            this.valid = false;
        } else if (App.gridContainsAnything(this.x + App.actualSnap, this.y, this.id)) {
            this.valid = false;
        } else if (App.gridContainsAnything(this.x - App.actualSnap, this.y + App.actualSnap, this.id)) {
            this.valid = false;
        } else if (App.gridContainsAnything(this.x, this.y + App.actualSnap, this.id)) {
            this.valid = false;
        } else if (App.gridContainsAnything(this.x + App.actualSnap, this.y + App.actualSnap, this.id)) {
            this.valid = false;
        } else {
            this.valid = true;
        }

        // Wire color
        var color = 'white';

        if (this.placed) {
            color = '#9e9e9e';
        }

        if (!this.valid) {
            color = 'red';
        }

        if (this.pins.input.powered) {
            color = '#ffa200';
        }

        // Draw it
        var a = App.actualSnap;
        context.beginPath();
        context.moveTo(this.x, this.y);
        context.lineTo(this.x, this.y + a);

        context.moveTo(this.x - (a * 1), this.y + a);
        context.lineTo(this.x + (a * 1), this.y + a);

        context.moveTo(this.x - (a * 0.7), this.y + (a * 1.3));
        context.lineTo(this.x + (a * 0.7), this.y + (a * 1.3));

        context.moveTo(this.x - (a * 0.35), this.y + (a * 1.6));
        context.lineTo(this.x + (a * 0.35), this.y + (a * 1.6));

        // Styles that applies to wires AND wire endpoints
        context.strokeStyle = color;
        context.fillStyle = color;
        context.lineWidth = 2;

        // Draw call
        context.stroke();

        // Draw the wire node
        App.drawWireEndpoint(context, this.x, this.y);

        // No longer dirty
        this.dirty = false;
    }

    App.registerComponent('Ground', Ground);
})();
