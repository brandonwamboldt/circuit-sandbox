(function (app) {
    app.hasGridComp = function(gridIndex, type, componentId) {
        if (typeof type === 'string') {
            return app.grid[gridIndex] && app.grid[gridIndex][type] !== undefined && app.grid[gridIndex][type].indexOf(componentId) === -1;
        } else {
            if (!app.grid[gridIndex]) {
                return false;
            }

            for (atype in app.grid[gridIndex]) {
                // Contains a component that wasn't in the exclude array and doesn't
                // belong to the given component
                if (type.indexOf(type) >= 0 && app.grid[gridIndex][atype].indexOf(componentId) === -1) {
                    return true;
                }
            }

            return false;
        }
    }

    app.gridContainsAnythingExcept = function(gridIndex, exclude, componentId) {
        if (!app.grid[gridIndex]) {
            return false;
        }

        for (type in app.grid[gridIndex]) {
            // Contains a component that wasn't in the exclude array and doesn't
            // belong to the given component
            if (exclude.indexOf(type) === -1 && app.grid[gridIndex][type].indexOf(componentId) === -1) {
                return true;
            }
        }

        return false;
    }

    app.gridContainsAnything = function(x, y, componentId) {
        if (!app.grid[x + '.' + y]) {
            return false;
        }

        for (type in app.grid[x + '.' + y]) {
            // Contains a component that wasn't in the exclude array and doesn't
            // belong to the given component
            if (app.grid[x + '.' + y][type].indexOf(componentId) === -1) {
                return true;
            }
        }

        return false;
    }

    app.drawGridBackgroundLayer = function(width, height) {
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

    app.addToGrid = function(x, y, type, componentId) {
        if (app.grid[x + '.' + y] === undefined) {
            app.grid[x + '.' + y] = {};
        }

        if (app.grid[x + '.' + y][type] === undefined) {
            app.grid[x + '.' + y][type] = [];
        }

        app.grid[x + '.' + y][type].push(componentId);
    }
})(window.App);
