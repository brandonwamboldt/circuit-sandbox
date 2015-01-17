(function() {
    var Transistor = function(attributes) {
        this.id          = attributes.id || -1;
        this.type        = App.TYPE_TRANSISTOR;
        this.dirty       = true;
        this.x           = attributes.x;
        this.y           = attributes.y;
        this.placed      = attributes.placed === undefined ? true : attributes.place;
        this.connectable = true;
        this.drawNodes   = 1;

        // Pins
        this.pins = {
            collector: {
                connected_to: [],
                power_sources: [],
                label: 'Collector',
                x: 0,
                y: 0
            },
            emitter: {
                connected_to: [],
                power_sources: [],
                label: 'Emitter',
                x: 0,
                y: 0
            },
            base: {
                connected_to: [],
                power_sources: [],
                label: 'Base',
                x: 0,
                y: 0
            }
        };

        // Is this component currently in a valid state (e.g. can it be placed)
        this.valid = true;
    }

    Transistor.prototype.serialize = function() {

    }

    Transistor.prototype.isReceivingPower = function(receivingPower, x, y, sourceId, notifiedBy) {
        var pin, pinId, index;
        var changed = false;
        var transistorWasOn     = this.pins.base.power_sources.length > 0 && (this.pins.collector.power_sources.length > 0 || this.pins.emitter.power_sources.length > 0);
        var emitterWasPowered   = this.pins.emitter.power_sources.length > 0;
        var collectorWasPowered = this.pins.collector.power_sources.length > 0;

        for (pinId in this.pins) {
            pin = this.pins[pinId];

            if (x === pin.x && y === pin.y) {
                index = pin.power_sources.indexOf(sourceId);

                if (index === -1 && receivingPower) {
                    pin.power_sources.push(sourceId);
                    changed = true;
                } else if (index !== -1 && !receivingPower) {
                    pin.power_sources.splice(index, 1);
                    changed = true;
                }

                break;
            }
        }

        var transistorIsOn     = this.pins.base.power_sources.length > 0 && (this.pins.collector.power_sources.length > 0 || this.pins.emitter.power_sources.length > 0);
        var emitterIsPowered   = this.pins.emitter.power_sources.length > 0;
        var collectorIsPowered = this.pins.collector.power_sources.length > 0;

        if (changed) {
            App.dirty.component = true;

            if ((!transistorWasOn && transistorIsOn) || (transistorWasOn && !transistorIsOn)) {
                if (emitterWasPowered && !emitterIsPowered) {
                    pin = this.pins.collector;
                } else {
                    pin = this.pins.emitter;
                }

                for (idx in pin.connected_to) {
                    if (pin.connected_to[idx] !== notifiedBy && pin.connected_to[idx] !== undefined) {
                        App.components[pin.connected_to[idx]].isReceivingPower(transistorIsOn, pin.x, pin.y, this.id, this.id);
                    }
                }
            }
        }
    }

    Transistor.prototype.connectTo = function(componentId, x, y, notifiedBy) {
        //console.log('Transistor.connectTo called, connecting ' + this.id + ' to ' + componentId)

        for (var pin in this.pins) {
            if (this.pins[pin].x === x && this.pins[pin].y === y) {
                this.pins[pin].connected_to.push(componentId);
                return;
            }
        }
    }

    Transistor.prototype.setXY = function(placed, x, y) {
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

    Transistor.prototype.place = function() {
        if (this.id >= 0) {
            //console.log('Transistor.place called on already placed component');
            return false;
        } else {
            this.id = App.components.length;
            //console.log('Transistor.place called for component ID#%d', this.id);
        }

        // Important this goes first lol
        App.unplacedComponent = null;

        var compIds = null, pin = null;

        // Setup our pin coords
        this.pins.collector.x = this.x;
        this.pins.collector.y = this.y;
        this.pins.emitter.x = this.x;
        this.pins.emitter.y = this.y + (App.actualSnap * 2);
        this.pins.base.x = this.x - App.actualSnap;
        this.pins.base.y = this.y + App.actualSnap;

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
        App.addToGrid(this.x - App.actualSnap * 1, this.y, App.TYPE_TRANSISTOR, this.id);
        App.addToGrid(this.x - App.actualSnap * 0, this.y + App.actualSnap, App.TYPE_TRANSISTOR, this.id);

        return true;
    }

    Transistor.prototype.draw = function() {
        context = App.context.main;

        // Determine the context to draw the component on
        if (this.placed) {
            context = App.context.component;
        }

        // Check if any of the grid squares we occupy are already occupied
        if (App.gridContainsAnythingExcept((this.x - App.actualSnap) + '.' + this.y, [App.TYPE_WIRE_ENDPOINT, App.TYPE_VERTICAL_WIRE, App.TYPE_HORIZONTAL_WIRE], this.id)) {
            this.valid = false;
        } else if (App.gridContainsAnythingExcept(this.x + '.' + this.y, [App.TYPE_WIRE_ENDPOINT, App.TYPE_VERTICAL_WIRE, App.TYPE_HORIZONTAL_WIRE], this.id)) {
            this.valid = false;
        } else if (App.gridContainsAnythingExcept((this.x - App.actualSnap) + '.' + (this.y + App.actualSnap), [App.TYPE_WIRE_ENDPOINT, App.TYPE_VERTICAL_WIRE], this.id)) {
            this.valid = false;
        } else if (App.gridContainsAnything(this.x, this.y + App.actualSnap, this.id)) {
            this.valid = false;
        } else if (App.gridContainsAnythingExcept(this.x + '.' + (this.y + App.actualSnap * 2), [App.TYPE_WIRE_ENDPOINT, App.TYPE_VERTICAL_WIRE, App.TYPE_HORIZONTAL_WIRE], this.id)) {
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

        var transistorIsOn = this.pins.base.power_sources.length > 0 && (this.pins.collector.power_sources.length > 0 || this.pins.emitter.power_sources.length > 0);

        if (transistorIsOn) {
            color = '#0cff00';
        } else if (this.pins.base.power_sources.length > 0 || this.pins.collector.power_sources.length > 0 || this.pins.emitter.power_sources.length > 0) {
            color = '#f0ff00';
        }

        // Draw it
        var s = App.actualSnap;
        context.beginPath();

        // Input pin (top)
        context.moveTo(this.x, this.y);
        context.lineTo(this.x, this.y + (s * 0.5));
        context.lineTo(this.x - (s * 0.5), this.y + (s * 0.75));

        // Output pin (bottom)
        context.moveTo(this.x, this.y + (s * 2));
        context.lineTo(this.x, this.y + (s * 1.5));
        context.lineTo(this.x - (s * 0.5), this.y + (s * 1.25));

        // Conductive material (side)
        context.moveTo(this.x - (s * 0.5), this.y + (s * 0.6));
        context.lineTo(this.x - (s * 0.5), this.y + (s * 1.4));

        // Control pin
        context.moveTo(this.x - (s * 0.5), this.y + (s * 1));
        context.lineTo(this.x - (s * 1) + 3, this.y + (s * 1));

        // Styles that applies to wires AND wire endpoints
        context.strokeStyle = color;
        context.fillStyle = color;
        context.lineWidth = 2;

        // Draw call
        context.stroke();

        // Wire node
        App.drawWireEndpoint(context, this.x, this.y, null, true);
        App.drawWireEndpoint(context, this.x, this.y + (App.actualSnap * 2), null, true);
        App.drawWireEndpoint(context, this.x - (s * 1), this.y + (s * 1), null, true);

        // No longer dirty
        this.dirty = false;
    }

    App.registerComponent('Transistor', Transistor);
})();
