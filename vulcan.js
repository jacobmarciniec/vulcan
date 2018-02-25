"use strict";

/*
 * Vulcan
 * =======
 * Copyright (c) 2018 Jacob Marciniec
 * Github repository: https://github.com/foxyjacob/vulcan
 * License:           MIT
 * ========================================================================= */

/*
 * TODO: on click, calculate trajectory so that the shell actually detonates at
 * the target
 * TODO: calculate positions of bodies as a function of time, not their most
 * recent parameters and the time since the last frame repaint
 * TODO: add tests
 * TODO: account for distance along a parabolic path in calculations
 * TODO: account for special relativety in calculations
 *
 * NOTE: The change in position of bodies is based on time, not frame repaints.
 * Therefore, if there is lag in repaints, bodies will appear to make drastic
 * changes in position. However, the change in position of bodies
 * assumes a constant acceleration and velocity since the last repaint, and
 * this inaccurately positions bodies which travel on (for instance) parabolic
 * paths as well as bodies with accelerations and velocities that change
 * over time. This inaccuracy is directly proptional to the framerate, and
 * should be impercieveable for framerates greater than 30fps (this is a rough,
 * uncalculated approximation).
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

/* Scaling
 * ------------------------------------------------------------------------- */

/**
 * The number of pixels that equal 1 meter.
 * @constant {number}
 */
const SCALE = 10;


/* Framerate monitoring
 * ------------------------------------------------------------------------- */

/**
 * The framerate at which shells should be blocked from spawning.
 * @constant {number}
 */
const FRAMERATE_TOLERANCE = 15 /* f/s */;

/**
 * Timestamp of the most recent screen repaint.
 * @var {boolean}
 */
var mostRecentRepaint;

/**
 * The best approximation of the screen's current framerate.
 * @var {boolean}
 */
var framerate;


/* Physical constants
* ------------------------------------------------------------------------- */

/**
 * The acceleration due to gravity on the y axis.
 * @constant {number}
 */
const ACCELERATION_DUE_TO_GRAVITY = -9.80665 /* m/s² */;

/**
 * The density of air.
 * @constant {number}
 */
const AIR_DENSITY = 1.29 /* kg/m³ */;


/** Stars
 * ------------------------------------------------------------------------- */

/**
 * The cross-sectional area of a star. NOTE: Stars are assumed to be spheres,
 * and therefore have an equal cross-sectional area in all directions of motion.
 * @constant {number}
 */
const STAR_CROSS_SECTIONAL_AREA = 0.01 /* m² */;

/**
 * The mass of a star.
 * @constant {number}
 */
const STAR_MASS = 0.01 /* kg */;

/**
 * The drag coefficient of a star.
 * @constant {number}
 */
const STAR_DRAG_COEFFICIENT = 0.4;

/**
 * The number of stars in a shell.
 * @constant {number}
 */
const STAR_COUNT = 100;


/* Shells
 * ------------------------------------------------------------------------- */

/**
 * The mass of a shell.
 * @constant {number}
 */
const SHELL_MASS = 0.6 + (STAR_MASS * STAR_COUNT); /* kg */

/**
 * The thrust a shell generates.
 * @constant {number}
 */
const SHELL_THRUST = 100 /* newtons */;

/**
 * The drag coefficient of a shell.
 * @constant {number}
 */
const SHELL_DRAG_COEFFICIENT = 0.47;

/**
 * The cross-sectional area of a shell. NOTE: Shells are assumed to be spheres,
 * and therefore have an equal cross-sectional area in all directions of motion.
 * @constant {number}
 */
const SHELL_CROSS_SECTIONAL_AREA = 0.002 /* m² */;


/* Spawning a randomly-aimed firework
 * ------------------------------------------------------------------------- */

/**
 * The minimum amount of time (in seconds) that should pass before a random
 * firework is spawned.
 * @constant {number}
 */
const MINIMUM_RANDOM_SPAWN_PERIOD = 2 /* seconds */;

/**
 * The maximum amount of time (in seconds) that should pass before a random
 * firework is spawned. NOTE: The maximum spawning period is a soft limit i.e.
 * it can be exceeded, for instance if the framerate is very low.
 * @constant {number}
 */
const MAXIMUM_RANDOM_SPAWN_PERIOD = 5 /* seconds */;

/**
 * Timestamp of the most recent time a random firework was spawned.
 * @var {number}
 */
var mostRecentRandomSpawn;

/**
 * The amount of time that should pass until the next random fireork is spawned
 * (in seconds from the most recent spawn). NOTE: The spawn period is reset
 * whenever a firework is launched (e.g. manually via mouse click).
 * @var {number}
 */
var currentRandomSpawnPeriod;

/**
 * Resets the most recent random firework spawn time and the period until the
 * next random spawn.
 * @returns {undefined}
 */
function resetRandomSpawn() {

    mostRecentRandomSpawn = getArbitraryTime();
    currentRandomSpawnPeriod = getRandomArbitrary(
        MINIMUM_RANDOM_SPAWN_PERIOD,
        MAXIMUM_RANDOM_SPAWN_PERIOD
    );

    return;

}


/* Helper functions
 * ------------------------------------------------------------------------- */

/**
 * Generates a random integer within a given range.
 * @param {number} min - The lower limit to the range (inclusive).
 * @param {number} max - The upper limit to the range (inclusive).
 * @returns {number} A random integer within the given range.
 */
function getRandomInteger(min, max) {

    min = Math.ceil(min);
    max = Math.floor(max);

    return Math.floor(Math.random() * (max - min + 1)) + min;

}


/**
 * Calculates a random floating-point number within a given range.
 * @param {number} min - The lower limit to the range (inclusive).
 * @param {number} max - The upper limit to the range (exclusive).
 * @returns {number} A random number within the given range.
 */
function getRandomArbitrary(min, max) {

    return Math.random() * (max - min) + min;

}


/**
 * Converts a given theoretical position (i.e. with its origin at the
 * bottom-left corner and in units of meters) to its position on the canvas
 * (i.e. with its origin at the top-left corner and in units of pixels) using a
 * predetermined scaling factor.
 * @param {number} position - The position to convert in theoretical context.
 * @returns {number} The position in the context of the canvas.
 */
function mapToCanvas(position) {

    let scale = (component) => {
        return component * SCALE;
    };

    let invert = (component, center) => {
        return center + (center - component);
    };

    let verticalCenter = canvas.offsetHeight / 2;

    return [
        scale(position[0]),
        invert(scale(position[1]), verticalCenter)
    ];

}


/**
 * Converts a given position on the canvas (i.e. with its origin at the
 * top-left corner and in units of pixels) to its theoretical position (i.e.
 * with its origin at the bottom-left corner and in units of meters) using a
 * predetermined scaling factor.
 * @param {number} position - The position to convert in context of the canvas.
 * @returns {number} The position in theoretical context.
 */
function mapFromCanvas(position) {

    let scale = (component) => {

        return component / SCALE;

    };

    let invert = (component, center) => {

        return center + (center - component);

    };

    let verticalCenter = canvas.offsetHeight / 2;

    return [
        scale(position[0]),
        scale(invert(position[1], verticalCenter))
    ];

}


/**
 * Provides a very acurrate, but arbitrary timestamp that is helpful for
 * calculating changes in time between parts of script execution.
 * @returns {number} An arbitrary timestamp in seconds.
 */
function getArbitraryTime() {

    return performance.now() / 1000;

}


/**
 * Calculates the distance a body has traveled given its inital speed, the
 * total travel time, and its constant acceleration. d=vt+(1/2)at²
 * @param {number} initialSpeed - The object's inital speed in m/s.
 * @param {number} time - The period of time in seconds.
 * @param {number} acceleration - The object's acceleration in m/s².
 * @returns {number} Distance in meters.
 */
function calculateDistance(initialSpeed, time, acceleration) {

    return (initialSpeed * time) + (0.5 * acceleration * (time * time));

}


/**
 * Calculates the displacement of a body given its initial and final position.
 * @param {number} initialPosition - The object's inital position.
 * @param {number} finalPosition - The object's final position.
 * @returns {number} The object's displacement.
 */
function calculateDisplacement(initalPosition, finalPosition) {

    let components = [
        finalPosition[0] - initalPosition[0],
        finalPosition[1] - initalPosition[1]
    ];

    return Math.sqrt(Math.pow(components[0], 2) + Math.pow(components[1], 2));

}


/**
 * Calculates the speed of a body given the distance it has traveled and the
 * total amount of travel time.
 * @param {number} distance - The distance traveled in meters.
 * @param {number} time - The period of time in seconds.
 * @returns {number} Speed in m/s.
 */
function calculateSpeed(distance, time) {

    return distance / time;

}


/**
 * Calculates the acceleration due to drag of a body given the density of the
 * fluid in which it is traveling, its drag coefficient, its cross sectional
 * area in the direction of motion, its speed, and its mass.
 * F = 0.5ρCAv²
 * F = ma
 * @param {number} fluidDensity - The density of the fluid in kg/m³.
 * @param {number} dragCoefficient - The body's drag coefficient.
 * @param {number} crossSectionalArea - The body's cross-sectional area in m².
 * @param {number} speed - The body's speed in m/s.
 * @returns {number} Acceleration due to drag in m/s².
 */
function calculateAccelerationDueToDrag(fluidDensity, dragCoefficient, crossSectionalArea, velocity, mass) {

    let speed = Math.sqrt(Math.pow(velocity[0], 2) + Math.pow(velocity[1], 2));

    let drag = -(0.5 * fluidDensity * dragCoefficient * crossSectionalArea * (speed * speed));

    let acceleration = [
        (drag / mass) * (velocity[0] / speed),
        (drag / mass) * (velocity[1] / speed)
    ];

    return acceleration;

}


/**
 * @param {Array} initialPosition
 * @param {Array} initalVelocity
 * @param {Array} initalAcceleration
 * @param {Number} mass
 * @param {Number} dragCoefficient
 * @param {Number} crossSectionalArea
 */
function Body(initialPosition, initalVelocity, initalAcceleration, mass, dragCoefficient, crossSectionalArea) {

    this.currentPosition     = initialPosition;
    this.currentVelocity     = initalVelocity;
    this.currentAcceleration = initalAcceleration;

    this.mass                = mass;
    this.dragCoefficient     = dragCoefficient;
    this.crossSectionalArea  = crossSectionalArea;

    this.spawned             = false;
    this.lastUpdate          = null;

}


/* Body class
 * ------------------------------------------------------------------------- */

/**
* Updates a body's current position, velocity, and acceleration.
* @returns {Array} The body's new position.
*/
Body.prototype.update = function() {

    if (!this.lastUpdate) {

        this.lastUpdate = getArbitraryTime();

        return;

    }

    let lastPosition     = this.currentPosition;
    let lastVelocity     = this.currentVelocity;
    let lastAcceleration = this.currentAcceleration;

    let timeNow   = getArbitraryTime();
    let timeDelta = timeNow - this.lastUpdate;

    let displacement = [
        calculateDistance(lastVelocity[0], timeDelta, lastAcceleration[0]),
        calculateDistance(lastVelocity[1], timeDelta, lastAcceleration[1])
    ];


    let accelerationDueToDrag =
        calculateAccelerationDueToDrag(
            AIR_DENSITY,
            this.dragCoefficient,
            this.crossSectionalArea,
            lastVelocity,
            this.mass
        );

    let accelerationDueToThrust = [0, 0];

    if (this.getAccelerationDueToThrust) {

        accelerationDueToThrust = this.getAccelerationDueToThrust();

    }

    this.currentPosition = [
        (lastPosition[0] + displacement[0]),
        (lastPosition[1] + displacement[1])
    ];

    // XXX: this does not account for any paths other than lines
    this.currentVelocity = [
        calculateSpeed(displacement[0], timeDelta),
        calculateSpeed(displacement[1], timeDelta)
    ];

    this.currentAcceleration = [
        (accelerationDueToThrust[0] || 0) + (accelerationDueToDrag[0] || 0),
        (accelerationDueToThrust[1] || 0) + (accelerationDueToDrag[1] || 0) + ACCELERATION_DUE_TO_GRAVITY
    ];

    this.lastUpdate = timeNow;

    return this.currentPosition;

};


/**
* Draws the body on the canvas using its current position.
* @returns {undefined}
*/
Body.prototype.draw = function() {

    let mappedPosition = mapToCanvas(this.currentPosition);

    canvasContext.beginPath();
    canvasContext.arc(mappedPosition[0], mappedPosition[1], 1, 0, 2 * Math.PI);
    canvasContext.closePath();
    canvasContext.fillStyle = this.color || "rgb(200,0,0)";
    canvasContext.fill();
    return;

};


/* Shell class
 * ------------------------------------------------------------------------- */

/**
 * @param {Array} target
 */
function Shell(target) {

    this.target    = target = target || Shell.getRandomTarget();
    this.detonated = false;
    this.color     = Shell.getRandomColor();
    let laucherPosition = Shell.getLauncherPosition();

    Body.call(
        this,
        laucherPosition,                    // initialPosition
        [0, 0],                             // initalVelocity
        Shell.calculateInitialAcceleration( // initalAcceleration
            laucherPosition,
            target,
            SHELL_MASS,
            SHELL_THRUST
        ),
        SHELL_MASS,                         // mass
        SHELL_DRAG_COEFFICIENT,             // dragCoefficient
        SHELL_CROSS_SECTIONAL_AREA          // crossSectionalArea
    );
}

Shell.prototype = Object.create(Body.prototype);
Shell.prototype.constructor = Shell;


/**
* Inserts the shell into the global shells array for processing by the
* animation loop.
* @returns {Shell} Itself.
*/
Shell.prototype.spawn = function() {

    this.spawned = true;

    // XXX: this has nothing to do with a shell
    resetRandomSpawn();

    shells.push(this);

    return this;

};


/**
* "Explodes" the shell, spawning stars.
* @returns {undefined}
*/
Shell.prototype.detonate = function() {

    this.detonated = true;
    let starCount  = 0;

    while (starCount < STAR_COUNT) {

        new Star(this).spawn();
        starCount += 1;

    }

    return;

};


/**
* @returns {Array} The acceleration due to thrust.
*/
Shell.prototype.getAccelerationDueToThrust = function() {

    let velocity    = this.currentVelocity;

    let speed       =
        Math.sqrt(Math.pow(velocity[0], 2) + Math.pow(velocity[1], 2));

    let proportions = [
        velocity[0] / speed,
        velocity[1] / speed
    ];

    return [
        proportions[0] * SHELL_THRUST / SHELL_MASS,
        proportions[1] * SHELL_THRUST / SHELL_MASS
    ];

};


/**
 * Gets the position from which shells should be launched right now. I.e. the
 * horizontal center and vertical bottom of the canvas.
 * @returns {Array} the shell's laucher's position.
 */
Shell.getLauncherPosition = function() {

    return mapFromCanvas([(canvas.offsetWidth / 2), canvas.offsetHeight + 20]);

};


/**
 * Calculates a shell's acceleration's X and Y components given it's initial
 * position, target position, and total acceleration.
 * @param {Array} initalPosition - The shell's inital position.
 * @param {Array} target - The shell's target position.
 * @param {number} totalAcceleration - The shell's total acceleration.
 * @returns {Array} the shell's inital acceleration in m/s².
 */
Shell.calculateInitialAcceleration = function(initalPosition, target, mass, thrust) {

    let deltaX = target[0] - initalPosition[0];
    let deltaY = target[1] - initalPosition[1];
    let displacment = Math.sqrt(Math.pow(deltaX, 2) + Math.pow(deltaY, 2));
    let xProportion = deltaX / displacment;
    let yProportion = deltaY / displacment;
    let totalAcceleration = thrust / mass;

    return [
        totalAcceleration * xProportion,
        totalAcceleration * yProportion
    ];

};


/**
 * Generates a random color that a firework can be.
 * @returns {String} A color in hsl(hhh, sss, lll) format.
 */
Shell.getRandomColor = function() {

    let randomHue        = getRandomInteger(  0, 360);
    let randomSaturation = getRandomInteger( 70, 100).toString() + "%";
    let randomLightness  = getRandomInteger( 50,  70).toString() + "%";
    return "hsl(" + randomHue + "," + randomSaturation + "," + randomLightness + ")";

};


/**
 * Generates a random position in the upper half of the canvas.
 * @returns {Array} A random position in the upper half of the canvas.
 */
Shell.getRandomTarget = function() {

    return mapFromCanvas([
        getRandomInteger(0, canvas.offsetWidth),
        getRandomInteger(0, (canvas.offsetHeight / 2))
    ]);
};


/* Star class
 * ------------------------------------------------------------------------- */

/**
 * > [S]tars are pellets or simply pieces of pyrotechnic composition which
 * > . . . when ignited, burn a certain color or make a certain spark effect.
 * > (https://en.wikipedia.org/wiki/Pyrotechnic_star, 24 January 2018)
 */
function Star(shell) {

    /* XXX: Although it is not physically accurate to give a star an inital
     * velocity (as though it spontaneously recieved it) it will be given one,
     * since its acceleration due to the detonation of its shell would be so
     * large, and only exist for such a short period of time that it is
     * accurate to assume so for the purposes of this project. */

    /* XXX: It is also inaccurate to give stars such a large range of inital
     * velocities. In reality, they would all have very similar post-detination
     * velocities. In this project however, the wide range of velocities
     * creates a 3D effect (stars with low velocities are percieved as "coming
     * at" or "flying away from" you). */
    let randomMagnitude = getRandomInteger(3, 100);
    let randomDirection = getRandomArbitrary(0, 2 * Math.PI);
    let randomVelocity = [
        Math.cos(randomDirection) * randomMagnitude,
        Math.sin(randomDirection) * randomMagnitude
    ];

    Body.call(
        this,
        shell.currentPosition,    // initialPosition
        randomVelocity,           // initalVelocity
        [0, 0],                   // initalAcceleration
        STAR_MASS,                // mass
        STAR_DRAG_COEFFICIENT,    // dragCoefficient
        STAR_CROSS_SECTIONAL_AREA // crossSectionalArea
    );

    // How long until the star burns out
    this.shell     = shell;
    this.duration  = getRandomArbitrary(2.5, 3);
    this.decayed   = false;
    this.color     = shell.color;

}


Star.prototype = Object.create(Body.prototype);
Star.prototype.constructor = Star;


/**
 * Inserts the star into the global stars array for processing by the
 * animation loop.
 * @returns {Star} Itself.
 */
Star.prototype.spawn = function() {

    this.spawned = getArbitraryTime();
    stars.push(this);
    return this;

};


/* Fanfare
 * ------------------------------------------------------------------------- */

/**
 * Whether a fanfare is in progress.
 * @var {boolean}
 */
var fanfareInProgress = false;

/**
 * Spawns 16 random shells a second for approximately 4 seconds, simulating a
 * fun fireworks show.
 * @returns {undefined}
 */
function fanfare() {

    // allow only one fanfare at a time
    if (fanfareInProgress)
        return;

    fanfareInProgress = true;

    let start = getArbitraryTime();
    let timeSinceStart;

    let fanfareId = setInterval(() => {

        new Shell().spawn();

        timeSinceStart = getArbitraryTime() - start;

        if ((timeSinceStart > 4) && fanfareId) {

            clearInterval(fanfareId);
            fanfareInProgress = false;

        }

    }, 62.5);

    return;

}


/* Animation loop
 * ------------------------------------------------------------------------- */

/**
 * The canvas element.
 * @var {HTMLCanvasElement}
 */
var canvas = document.querySelector("canvas");

/**
 * The canvas element's 2D rendering context.
 * @var {RenderingContext}
 */
var canvasContext = canvas.getContext("2d");

/**
 * Active and/or queued shells.
 * @var {boolean}
 */
var shells = [];

/**
 * Active and/or queued stars.
 * @var {boolean}
 */
var stars  = [];

/**
 * Updates animatable objects, etc.
 * @returns {undefined}
 */
function animationLoop() {
    let timeNow = getArbitraryTime();

    // keep track of framerate
    if (!mostRecentRepaint) {

        mostRecentRepaint = timeNow;

    } else {

        // the amount of time that has passed since the last repaint
        let change = timeNow - mostRecentRepaint;

        // calculate frames per second
        framerate = 1 / change;

        mostRecentRepaint = timeNow;

    }

    // spawn a random firework
    if (framerate > FRAMERATE_TOLERANCE) {

        // the amount of time that has passed since the last random spawn
        let change = timeNow - mostRecentRandomSpawn;

        if (!mostRecentRandomSpawn || change > currentRandomSpawnPeriod) {

            new Shell(Shell.getRandomTarget()).spawn();
            mostRecentRandomSpawn = timeNow;

        }

    }

    // Update shells and stars, throttling the spawning of new shells if the
    // framerate is below the configured tolerance
    for (let i = 0; i < shells.length; i++) {

        let shell = shells[i];

        let currentDisplacment = calculateDisplacement(Shell.getLauncherPosition(), shell.currentPosition);

        let targetDisplacement  = calculateDisplacement(Shell.getLauncherPosition(), shell.target);

        let exceededTarget = currentDisplacment > targetDisplacement;

        if (exceededTarget) {
            shell.detonate();
        }

        if (shell.detonated) {

            shells.splice(i, 1);
            continue;

        }

        if ((framerate > FRAMERATE_TOLERANCE) || shell.spawned) {

            shell.update();
            shell.draw();

        }

        continue;
    }

    for (let i = 0; i < stars.length; i++) {

        let star = stars[i];

        star.update();
        star.draw();

        let burnTime = getArbitraryTime() - star.spawned;

        if (burnTime > star.duration) {

            stars.splice(i, 1);
            continue;

        }

        continue;

    }

    canvasContext.globalCompositeOperation = "destination-out";
    canvasContext.fillStyle = "rgba(255, 255, 255, 0.2)";
    canvasContext.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
    canvasContext.globalCompositeOperation = "lighter";

    return window.requestAnimationFrame(animationLoop);

}

window.addEventListener("load", animationLoop);


canvas.addEventListener("click", (event) => {

    // XXX: clicks are redundantly mapped from, and then back to the canvas
    new Shell(mapFromCanvas([event.clientX, event.clientY])).spawn();

});


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

window.addEventListener("load", resetRandomSpawn);


// suggestion for initiating a fanfare
//var form = document.querySelector("form");
//form.addEventListener("submit", fanfare);

window.addEventListener("keyup", fanfare);
