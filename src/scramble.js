/**
 * Gets a random integer between min and max (inclusive)
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Random integer
 */
function getRandomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Gets a random character from the specified range
 * @param {number[]|number[][]} range - Array of character codes or ranges
 * @returns {string} Random character
 */
function getRandomChar(range) {
	let rand = 0;
	if (range.length === 2) {
		rand = getRandomInt(range[0], range[1]);
	} else {
		rand = range[getRandomInt(0, range.length - 1)];
	}
	return String.fromCharCode(rand);
}

/**
 * Creates a text scrambling animation
 * @param {HTMLElement} element - DOM element to animate
 * @param {Object} options - Configuration options
 * @param {boolean} [options.playOnMount=true] - Whether to start animation immediately
 * @param {string} options.text - Target text to scramble to
 * @param {number} [options.speed=1] - Animation speed multiplier
 * @param {number} [options.seed=1] - Number of random positions to scramble ahead
 * @param {number} [options.step=1] - How many characters to animate at once
 * @param {number} [options.tick=1] - How many frames between animation updates
 * @param {number} [options.scramble=1] - Number of random characters before settling
 * @param {number} [options.chance=1] - Probability (0-1) of character being scrambled
 * @param {boolean} [options.overflow=true] - Whether to start with element's current text
 * @param {number[]} [options.range=[65, 125]] - Range of character codes to use
 * @param {boolean|number} [options.overdrive=false] - Add extra characters at end or character code
 * @param {string[]} [options.ignore=[" "]] - Characters to skip in scrambling
 * @param {Function} [options.onAnimationStart] - Callback when animation begins
 * @param {Function} [options.onAnimationFrame] - Callback for each frame with current text
 * @param {Function} [options.onAnimationEnd] - Callback when animation completes
 * @returns {Object} Animation control methods: play(), updateText(), destroy()
 */
function scrambleText(element, options = {}) {
	if (!element) {
		throw new Error("Element is required for Scrambler");
	}

	// State
	let state = {
		node: element,
		rafId: 0,
		elapsed: 0,
		stepCount: 0,
		scrambleIndex: 0,
		control: [],
		overdriveIndex: 0,
		initialText: element.textContent, // Store initial text
	};

	// Default options
	const config = {
		playOnMount: true,
		text: "",
		speed: 1,
		seed: 1,
		step: 1,
		tick: 1,
		scramble: 1,
		chance: 1,
		overflow: true,
		range: [65, 125],
		overdrive: false,
		ignore: [" "],
		onAnimationStart: null,
		onAnimationFrame: null,
		onAnimationEnd: null,
		...options,
	};

	const fpsInterval = 1000 / (60 * config.speed);

	// Check for reduced motion preference
	const prefersReducedMotion =
		typeof window !== "undefined"
			? window.matchMedia("(prefers-reduced-motion: reduce)").matches
			: false;

	if (prefersReducedMotion) {
		config.step = config.text.length;
		config.chance = 0;
		config.overdrive = false;
	}

	/**
	 * Checks if a character should be ignored in scrambling
	 * @param {string} value - Character to check
	 * @param {*} replace - Value to use if not ignored
	 * @returns {string|*} Original value if ignored, replacement if not
	 */
	function setIfNotIgnored(value, replace) {
		return config.ignore.includes(`${value}`) ? value : replace;
	}

	/**
	 * Seeds random positions ahead of current index for erratic effect
	 * Uses the seed parameter to determine how many positions to scramble
	 */
	function seedForward() {
		if (state.scrambleIndex === config.text.length) return;

		for (let i = 0; i < config.seed; i++) {
			const index = getRandomInt(
				state.scrambleIndex,
				config.text.length - 1
			);

			// Only seed positions that haven't been scrambled yet
			if (index > state.scrambleIndex) {
				// Apply chance to seeded positions as well
				const shouldScramble = Math.random() < config.chance;

				state.control[index] = setIfNotIgnored(
					config.text[index],
					shouldScramble ? config.scramble : 0
				);
			}
		}
	}

	/**
	 * Advances the scramble animation by step amount
	 * Each position will show scramble number of random characters
	 */
	function stepForward() {
		for (let i = 0; i < config.step; i++) {
			if (state.scrambleIndex < config.text.length) {
				// Use chance to determine if this character should be scrambled
				const shouldScramble = Math.random() < config.chance;

				// Only set scramble count if position hasn't been seeded
				if (typeof state.control[state.scrambleIndex] !== "number") {
					state.control[state.scrambleIndex] = setIfNotIgnored(
						config.text[state.scrambleIndex],
						// If chance check fails, set to 0 to skip scrambling
						shouldScramble ? config.scramble : 0
					);
				}
				state.scrambleIndex++;
			}
		}
	}

	/**
	 * Ensures control array matches target text length
	 * Adds or removes positions as needed
	 */
	function resizeControl() {
		if (config.text.length < state.control.length) {
			state.control.splice(config.text.length);
		}
		for (let i = 0; i < config.step; i++) {
			if (state.control.length < config.text.length) {
				state.control.push(
					setIfNotIgnored(config.text[state.control.length + 1], null)
				);
			}
		}
	}

	/**
	 * Handles overdrive effect after main animation
	 * Optionally adds extra characters at the end
	 */
	function onOverdrive() {
		if (!config.overdrive) return;

		for (let i = 0; i < config.step; i++) {
			const max = Math.max(state.control.length, config.text.length);
			if (state.overdriveIndex < max) {
				state.control[state.overdriveIndex] = setIfNotIgnored(
					config.text[state.overdriveIndex],
					String.fromCharCode(
						typeof config.overdrive === "boolean"
							? 95
							: config.overdrive
					)
				);
				state.overdriveIndex++;
			}
		}
	}

	/**
	 * Processes one tick of the animation
	 * Combines step, resize, and seed effects
	 */
	function onTick() {
		stepForward();
		resizeControl();
		seedForward();
	}

	/**
	 * Renders current state of scrambled text
	 * Handles character transitions and animation completion
	 */
	function draw() {
		if (!state.node) return;

		let result = "";

		for (let i = 0; i < state.control.length; i++) {
			const controlValue = state.control[i];

			switch (true) {
				case typeof controlValue === "number" && controlValue > 0:
					// Show random character while scramble count is above 0
					result += getRandomChar(config.range);
					if (i <= state.scrambleIndex) {
						// Only decrease by 1 each frame, ensuring we get exactly
						// 'scramble' number of randomizations
						state.control[i] = controlValue - 1;
					}
					break;

				case controlValue === 0 && i < config.text.length:
					// When scramble count hits 0, show final character
					result += config.text[i];
					state.control[i] = config.text[i];
					break;

				case typeof controlValue === "string":
					// Already settled on final character
					result += controlValue;
					break;

				default:
					result += "";
			}
		}

		state.node.innerHTML = result;

		if (config.onAnimationFrame) {
			config.onAnimationFrame(result);
		}

		if (result === config.text) {
			state.control.splice(config.text.length);
			if (config.onAnimationEnd) {
				config.onAnimationEnd();
			}
			cancelAnimationFrame(state.rafId);
		}

		state.stepCount++;
	}

	/**
	 * Main animation loop using requestAnimationFrame
	 * Controls timing and triggers ticks based on speed
	 */
	function animate(time) {
		if (!config.speed) return;

		state.rafId = requestAnimationFrame(animate);
		onOverdrive();

		const timeElapsed = time - state.elapsed;
		if (timeElapsed > fpsInterval) {
			state.elapsed = time;

			if (state.stepCount % config.tick === 0) {
				onTick();
			}

			draw();
		}
	}

	/**
	 * Resets animation state for new run
	 * Handles overflow option for initial text
	 */
	function reset() {
		state.stepCount = 0;
		state.scrambleIndex = 0;
		state.overdriveIndex = 0;

		// Initialize control array based on overflow setting
		if (config.overflow) {
			state.control = state.initialText.split("");
		} else {
			state.control = new Array(config.text?.length);
		}
	}

	// Public API
	const api = {
		play() {
			cancelAnimationFrame(state.rafId);
			reset();
			if (config.onAnimationStart) {
				config.onAnimationStart();
			}
			state.rafId = requestAnimationFrame(animate);
		},

		updateText(newText) {
			config.text = newText;
			reset();
			api.play();
		},

		destroy() {
			cancelAnimationFrame(state.rafId);
			state.node = null;
		},
	};

	// Initialize
	if (config.playOnMount) {
		api.play();
	} else {
		// Just set up initial state without playing
		reset();
		draw();
	}

	return api;
}

export default scrambleText;
