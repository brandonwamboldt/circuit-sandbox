(function() {
    var Transistor = function(attributes) {
        this.id          = attributes.id || 0;
        this.type        = TYPE_TRANSISTOR;
        this.dirty       = true;
        this.x           = attributes.x;
        this.y           = attributes.y;
        this.placed      = attributes.placed === undefined ? true : attributes.place;
        this.inputPin    = null;
        this.outputPin   = null;
        this.controlPin  = null;
        this.connectable = true;
        this.drawNodes   = 1;

        // Pins
        this.pins = {
            collector: {
                connected_to: -1,
                power_sources: 0,
                label: 'Collector',
                x: 0,
                y: 0
            },
            emitter: {
                connected_to: -1,
                power_sources: 0,
                label: 'Emitter',
                x: 0,
                y: 0
            },
            base: {
                connected_to: -1,
                power_sources: 0,
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

    App.registerComponent('Transistor', Transistor);
})();
