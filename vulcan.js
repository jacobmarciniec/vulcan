/* Vulcan
 * TODO: account for potential update lag in calculations
 * TODO: account for computation time in calculations
 * TODO: account for special relativety in calculations
 *
 * Unless specified otherwise, positions are expressed as arrays like so:
 * [
 *     <position on x axis (in meters from left side of canvas)>,
 *     <position on y axis (in meters from bottom of canvas)>
 * ]
 *
 * Unless specified otherwise, velocities are expressed as arrays like so:
 * [
 *     <speed along x axis (in m/s)>,
 *     <speed along y axis (in m/s)>
 * ]
 *
 * Unless specified otherwise, accelerations are expressed as arrays like so:
 * [
 *     <acceleration along x axis (in m/s²)>,
 *     <acceleration along y axis (in m/s²)>
 * ]
 *
 */


// the number of pixels that equal 1 meter
const SCALE                      =  10;

// at what framerate rockets should be blocked from spawning
const FRAMERATE_TOLERANCE        =  15;

const ACCELERAION_DUE_TO_GRAVITY =  -9.80665 /*  m/s² */;
const AIR_DENSITY                =   1.29 /* kg/m³ */;

const TOTAL_ROCKET_ACCELERATION  =  26;

/* we assume that comets are spheres, and have an equal cross sectional area in
 * all directions */
const COMET_CROSS_SECTIONAL_AREA =   0.0001 /* m² */;
const COMET_MASS                 =   0.05 /* kg */;
const COMET_DRAG_COEFFICIENT     =   0.7;
const COMET_WEIGHT               = COMET_MASS * ACCELERAION_DUE_TO_GRAVITY;
const MINMUM_COMET_COUNT         =  25;
const MAXIMUM_COMET_COUNT        =  75;


var canvas        = document.querySelector("canvas");
var canvasContext = canvas.getContext("2d");


// active and/or queued rockets and comets
var rockets = [];
var comets  = [];

// for keeping track of the framerate
var mostRecentRepaint;
var framerate;

/**
 * Calculates a random integer within a given range.
 * @param {number} min - The lower limit to the range.
 * @param {number} max - The upper limit to the range.
 * @returns {number} A random integer within the given range.
 */
function getRandomInt(min, max) {

    return Math.random() * (max - min) + min;

}


/**
 * Converts a given number of pixels to meters using a predetermined scaling
 * factor.
 * @param {number} pixels - The number of pixels to convert.
 * @returns {number} The number of meters the given number of pixels represent.
 */
function pixelsToMeters(pixels) {

    return pixels / SCALE;

}


/**
 * Provides a very acurrate, but arbitrary timestamp that is helpful for
 * calculating changes in between parts of script execution.
 * @returns {number} An arbitrary timestamp in seconds.
 */
function getArbitraryTime() {

    return performance.now() * 1000;

}


/**
 * Calculates the distance a body has traveled given its inital speed, the
 * total travel time, and its constant acceleration.
 * @param {number} initialSpeed - The object's inital speed in m/s.
 * @param {number} time - The period of time in seconds.
 * @param {number} acceleration - The object's acceleration in m/s².
 * @returns {number} Distance in meters.
 */
function calculateDistance(initialSpeed, time, acceleration) {

    return (initialSpeed * time) + ((Math.pow(time, 2) * acceleration) / 2);

}


/**
 * Calculates the speed of a body given the distance it has traveled and the
 * total amount of travel time..
 * @param {number} distance - The distance traveled in meters.
 * @param {number} time - The period of time in seconds.
 * @returns {number} Speed in m/s.
 */
function calculateSpeed(distance, time) {

    return distance / time;

}


/**
 * Calculates the acceleration of a body given its inital speed, final speed,
 * and the total travel time.
 * @param {number} initialSpeed - The object's inital speed in m/s.
 * @param {number} finalSpeed - The object's final speed in m/s.
 * @param {number} time - The period of time in seconds.
 * @returns {number} Acceleration in m/s².
 */
function calculateAcceleration(initialSpeed, finalSpeed, time) {

    return (finalSpeed - initialSpeed) / time;

}


/**
 * Calculates the resistance due to drag of a body given the density of the
 * fluid in which it is traveling, its drag coefficient, its cross sectional
 * area in the direction of motion, and its speed.
 * @param {number} fluidDensity - the density of the fluid in kg/m³.
 * @param {number} dragCoefficient - The body's drag coefficient.
 * @param {number} crossSectionalArea - The body's cross-sectional area in m².
 * @param {number} speed - The body's speed in m/s.
 * @returns {number} Resistance due to drag in newtons.
 */
function calculateDrag(fluidDensity, dragCoefficient, crossSectionalArea, speed) {

    return (fluidDensity * dragCoefficient * crossSectionalArea * Math.pow(speed, 2)) / 2;

}


/**
 */
function Rocket(initalPosition, target) {

    this.spawned             = false;
    this.detonated           = false;

    this.initalPosition      = initalPosition;
    this.initalVelocity      = [0, 0];
    this.target              = target || this.getRandomTarget();
    this.acceleration        = Rocket.calculateInitialAcceleration(
        this.initalPosition,
        this.target,
        TOTAL_ROCKET_ACCELERATION
    );

    this.currentPosition     = [undefined, undefined];
    this.currentVelocity     = [];
    this.currentAcceleration = [
        0,
        0 + ACCELERAION_DUE_TO_GRAVITY
    ];
    this.recentPositions     = [];
    this.lastUpdate          = null;

    this.color               = this.getRandomColor();

}


/**
 * Updates a rocket's current position and velocity.
 * @returns {Array} The rocket's new position.
 */
Rocket.update = function() {

    if (!this.lastUpdate) {

        this.lastUpdate = getArbitraryTime();

        return;

    }

    let lastPosition     = this.currentPosition;
    let lastVelocity     = this.currentVelocity;
    let lastAcceleration = this.currentAcceleration;

    let timeNow   = getArbitraryTime();
    let timeDelta = timeNow - this.lastUpdate;

    let deltaXPosition =
        calculateDistance(lastVelocity[0], timeDelta, lastAcceleration[0]);

    let deltaYPosition =
        calculateDistance(lastVelocity[1], timeDelta, lastAcceleration[1]);

    this.currentPosition = [
        (lastPosition[0] + deltaXPosition),
        (lastPosition[1] + deltaYPosition)
    ];

    this.currentVelocity = [
        calculateSpeed(deltaXPosition, timeDelta),
        calculateSpeed(deltaYPosition, timeDelta)
    ];

    this.lastUpdate = timeNow;

    return this.currentPosition;

};


/**
 * Draws the rocket on the canvas using its recent positions.
 * @returns {undefined}
 */
Rocket.draw = function() {

    return;

};


/**
 * Calculates a rocket's acceleration's X and Y components given it's initial
 * position, target position, and total acceleration.
 * @param {Array} initalPosition - The rocket's inital position.
 * @param {Array} target - The rocket's target position.
 * @param {number} totalAcceleration - The rocket's total acceleration.
 * @returns {Array} the rocket's inital acceleration.
 */
Rocket.calculateInitialAcceleration = function(/*initalPosition*//*, target*//*, totalAcceleration*/) {

    return;

};


/**
 * Generates a random color that a firework can be.
 * @returns {String} A color in rgb() format.
 */
Rocket.getRandomColor = function() {

    return;

};


/**
 * Inserts the rocket into the global rockets array for processing by the game
 * loop.
 * @returns {Rocket} Itself.
 */
Rocket.spawn = function() {

    this.spawned = true;

    rockets.push(this);

    return this;

};


/**
 * "Explodes" the rocket, spawning comets.
 * @returns {undefined}
 */
Rocket.detonate = function() {

    this.detonated = true;
    let cometCount = getRandomInt(MINMUM_COMET_COUNT, MAXIMUM_COMET_COUNT);

    for (var i = 0; i < cometCount; i++) {

        comets.push(new Comet());

    }

    return;

};


Rocket.prototype.constructor = Rocket;


/**
 */
function Comet() {

    this.spawned          = false;
    this.decayed          = false;

    this.initialPosition  = this.finalPosition;

    /* Although it is not physically accurate to give a comet an inital
     * velocity (as though it spontaneously recieved it) it will be given one,
     * since its acceleration due to the detonation of its rocket would be so
     * large, and only exist for such a short period of time that it is
     * accurate to assume so for the purposes of this project. */
    this.initalVelocity   = [
        getRandomInt(100, 300) + this.currentVelocity[0],
        getRandomInt(100, 300) + this.currentVelocity[1]
    ];

    // How long until the comet burns out
    this.duration         = getRandomInt(0,1);

    this.dragCoefficient  = COMET_DRAG_COEFFICIENT;
    this.currentPosition  = [null, null];
 // this.color inherited from parent (Rocket)

}


/**
 * Inserts the comet into the global comets array for processing by the game
 * loop.
 * @returns {Comet} Itself.
 */
Comet.spawn = function() {

    this.spawned = getArbitraryTime();

};


/**
 * Updates a comet's current position and velocity.
 * @returns {Array} The comet's new position.
 */
Comet.update = function() {

    return;

};


/**
 * Draws the comet on the canvas using its recent positions.
 * @returns {undefined}
 */
Comet.draw = function() {

    return;

};


Comet.prototype = Object.create(Rocket.prototype);
Comet.prototype.constructor = Comet;


/**
 * Spawns 8 random rockets a second for 4 seconds, simulating a fun fireworks
 * show.
 * @returns {undefined}
 */
function fanfare() {

    return;

}


/**
 * Updates animatable objects, etc.
 * @returns {undefined}
 */
function gameLoop() {

    // keep track of framerate
    if (!mostRecentRepaint) {

        mostRecentRepaint = getArbitraryTime();

    } else {

        // get the amount of time that has passed since the last repaint
        let change = mostRecentRepaint - getArbitraryTime();

        // calculate frames per second
        framerate = 1 / change;

    }

    mostRecentRepaint = getArbitraryTime();

    // keep track of time

    // spawn a rocket every 3 seconds unless...

    // 1. the user clicks (then spawn a rocket to their click)

    // 2. a fanfare is in progress

    // Update rockets and comets, throttling the spawning of new rockets if the
    // framerate is below the configured tolerance
    for (let i = 0; i < rockets.length; i++) {

        let rocket = rockets[i];

        if (rocket.detonated) {

            rockets.splice(i, 1);
            continue;

        }

        if ((framerate > FRAMERATE_TOLERANCE) || rocket.spawned) {

            rocket.update();
            rocket.draw();

        }

        continue;
    }

    for (let i = 0; i < comets.length; i++) {

        let comet = comets[i];

        if (comet.decayed) {

            comets.splice(i, 1);
            continue;

        }

        continue;

    }

    return requestAnimationFrame(gameLoop);

}

window.addEventListener("load", gameLoop);


canvas.addEventListener("click", (/* event */) => {

    // spawn firework with target at click position
    // [event.clientX, event.clientY]

});


/* Cross-browser shim for requesting an animation frame
 * ----------------------------------------------------
 * Based on paulirish's shim, as it was on 2018 January 21:
 * https://www.paulirish.com/2011/requestanimationframe-for-smart-animating/
 *
 * The original code was edited.
 * ------------------------------------------------------------------------- */
var requestAnimationFrame = ( function() {

    return window.webkitRequestAnimationFrame ||
           window.mozRequestAnimationFrame    ||
           window.oRequestAnimationFrame      ||
           window.msRequestAnimationFrame     ||
    function(callback) {

        // Approximately 30 frames per second
        window.setTimeout( callback, 33 );

    };

})();


/* Resize event optimization
 * -------------------------
 * Shamelessly copied from developer.mozilla.org 2017 November 30:
 * https://developer.mozilla.org/en-US/docs/Web/Events/resize
 * ------------------------------------------------------------------------- */
var optimizedResize = (function() {

    var callbacks = [],
        running = false;

    // fired on resize event
    function resize() {
        if (!running) {
            running = true;

            if (window.requestAnimationFrame) {
                window.requestAnimationFrame(runCallbacks);
            } else {
                setTimeout(runCallbacks, 66);
            }
        }
    }

    // run the actual callbacks
    function runCallbacks() {
        callbacks.forEach(function(callback) {
            callback();
        });

        running = false;
    }

    // adds callback to loop
    function addCallback(callback) {
        if (callback) {
            callbacks.push(callback);
        }
    }

    return {
        // public method to add additional callback
        add: function(callback) {
            if (!callbacks.length) {
                window.addEventListener("resize", resize);
            }
            addCallback(callback);
        }
    };
}());


/**
 * Makes the canvas the same size as its parent and insures its width and
 * height attributes are set accordingly, so that no stretching occures.
 * @returns {undefined}
 */
function resizeCanvas() {

    canvas.style.width  = "100%";
    canvas.style.height = "100%";
    canvas.width        = canvas.offsetWidth;
    canvas.height       = canvas.offsetHeight;

    return;

}

window.addEventListener("load", resizeCanvas);
optimizedResize.add(resizeCanvas);


// suggestion for initiating a fanfare
let form = document.querySelector("form");
form.addEventListener("submit", fanfare);
