/* Floating modal window (expands from the trigger element) - lightweight helper.
   Exposes: window.PTBottomSheet.open(options) -> Promise<void>
*/

(() => {
	// Inject override styles to turn bottom sheets into floating cards
	const style = document.createElement("style");
	style.id = "pt-floating-sheet-override";
	style.textContent = `
		.pt-sheet-overlay {
			position: fixed !important;
			top: 0 !important;
			left: 0 !important;
			width: 100% !important;
			height: 100% !important;
			background: rgba(0, 0, 0, 0.15) !important;
			backdrop-filter: blur(24px) !important;
			-webkit-backdrop-filter: blur(24px) !important;
			z-index: 2000 !important;
			display: flex !important;
			align-items: center !important;
			justify-content: center !important;
			opacity: 0 !important;
			transition: opacity 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) !important;
			pointer-events: auto !important;
		}
		.pt-sheet-overlay.is-open {
			opacity: 1 !important;
		}
		.pt-sheet {
			position: relative !important;
			width: 95% !important;
			max-width: 500px !important;
			max-height: 90vh !important;
			background: color-mix(in srgb, var(--bg0, #0c0d0f) 40%, transparent) !important;
			backdrop-filter: blur(20px) !important;
			-webkit-backdrop-filter: blur(20px) !important;
			border: 1px solid rgba(255, 255, 255, 0.15) !important;
			border-radius: 24px !important;
			box-shadow: 0 24px 60px rgba(0, 0, 0, 0.8), 
						inset 0 1px 0 rgba(255, 255, 255, 0.15) !important;
			display: flex !important;
			flex-direction: column !important;
			overflow: hidden !important;
			transform-origin: center center !important;
			margin: 0 !important;
			bottom: auto !important;
			transition: max-width 0.3s ease, width 0.3s ease, max-height 0.3s ease !important;
		}
		@media (min-width: 768px) {
			.pt-sheet:has(.pt-detail),
			.pt-sheet:has(.pt-new-detail),
			.pt-sheet:has(.pt-gen),
			.pt-sheet:has(.pt-cal-detalle-sheet),
			.pt-sheet.pt-perfil-sheet,
			.pt-sheet.pt-sheet--large {
				max-width: 1100px !important;
				width: 92% !important;
				max-height: 90vh !important;
		}
		.pt-sheet:has(.pt-new-detail),
		.pt-sheet.pt-new-detail-sheet {
			border: none !important;
			background: color-mix(in srgb, var(--bg0, #0c0d0f) 60%, transparent) !important;
			backdrop-filter: blur(30px) !important;
			-webkit-backdrop-filter: blur(30px) !important;
			box-shadow: 0 24px 60px rgba(0, 0, 0, 0.9) !important;
		}
		.pt-sheet:has(.pt-new-detail) .pt-sheet-header,
		.pt-sheet.pt-new-detail-sheet .pt-sheet-header {
			display: none !important;
		}
		.pt-sheet:has(.pt-new-detail) .pt-sheet-content,
		.pt-sheet.pt-new-detail-sheet .pt-sheet-content {
			padding: 64px 0 0 0 !important;
		}
		.pt-sheet-header {
			display: none !important;
		}
		.pt-sheet-handle {
			display: none !important;
		}
		.pt-sheet-titlewrap {
			flex: 1 !important;
			padding: 0 !important;
		}
		.pt-sheet-title {
			margin: 0 !important;
			font-size: 20px !important;
			font-weight: 800 !important;
			color: #ffffff !important;
			letter-spacing: -0.5px !important;
		}
		.pt-sheet-subtitle {
			margin-top: 4px !important;
			font-size: 13px !important;
			color: rgba(255, 255, 255, 0.6) !important;
		}
		.pt-sheet-close {
			background: rgba(255, 255, 255, 0.08) !important;
			border: 1px solid rgba(255, 255, 255, 0.1) !important;
			color: #ffffff !important;
			width: 36px !important;
			height: 36px !important;
			border-radius: 50% !important;
			display: flex !important;
			align-items: center !important;
			justify-content: center !important;
			cursor: pointer !important;
			transition: all 0.2s ease !important;
			font-size: 22px !important;
			line-height: 1 !important;
			padding: 0 !important;
			margin: 0 !important;
			text-shadow: none !important;
			flex-shrink: 0 !important;
		}
		.pt-sheet-close:hover {
			background: rgba(255, 255, 255, 0.15) !important;
			transform: scale(1.05) !important;
		}
		.pt-sheet-close:active {
			transform: scale(0.95) !important;
		}
		.pt-sheet-content {
			flex: 1 !important;
			overflow-y: auto !important;
			padding: 64px 24px 24px 24px !important;
			-webkit-overflow-scrolling: touch !important;
		}
		.pt-sheet-back-btn {
			position: absolute !important;
			top: 16px !important;
			left: 50% !important;
			transform: translateX(-50%) !important;
			background: rgba(255, 255, 255, 0.08) !important;
			border: 1px solid rgba(255, 255, 255, 0.1) !important;
			color: #ffffff !important;
			padding: 8px 18px !important;
			border-radius: 999px !important;
			font-size: 13px !important;
			font-weight: 700 !important;
			display: inline-flex !important;
			align-items: center !important;
			justify-content: center !important;
			gap: 6px !important;
			cursor: pointer !important;
			z-index: 2100 !important;
			transition: all 0.2s ease !important;
			pointer-events: auto !important;
			backdrop-filter: blur(8px) !important;
			-webkit-backdrop-filter: blur(8px) !important;
			box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
		}
		.pt-sheet-back-btn:hover {
			background: rgba(255, 255, 255, 0.16) !important;
			transform: translateX(-50%) scale(1.05) !important;
		}
		.pt-sheet-back-btn:active {
			transform: translateX(-50%) scale(0.95) !important;
		}
		.pt-sheet-content::-webkit-scrollbar {
			width: 6px !important;
		}
		.pt-sheet-content::-webkit-scrollbar-track {
			background: transparent !important;
		}
		.pt-sheet-content::-webkit-scrollbar-thumb {
			background: rgba(255, 255, 255, 0.2) !important;
			border-radius: 3px !important;
		}
		.pt-sheet-content::-webkit-scrollbar-thumb:hover {
			background: rgba(255, 255, 255, 0.4) !important;
		}
	`;
	document.head.appendChild(style);

	// Track the last clicked element so we can use it as animation origin
	let _lastClickedEl = null;
	document.addEventListener("pointerdown", (ev) => {
		if (ev.target instanceof HTMLElement) {
			_lastClickedEl = ev.target;
		}
	}, { passive: true, capture: true });

	let activeCloseStack = [];
	let scrollLockCount = 0;
	let scrollLockPrev = null;

	const FOCUSABLE_SELECTOR = [
		"button",
		"[href]",
		"input",
		"select",
		"textarea",
		"[tabindex]:not([tabindex='-1'])",
	].join(",");

	const lockScroll = () => {
		const root = document.documentElement;
		if (scrollLockCount === 0) {
			scrollLockPrev = {
				overflow: root.style.overflow,
				paddingRight: root.style.paddingRight,
			};
			const scrollbarW = window.innerWidth - root.clientWidth;
			root.style.overflow = "hidden";
			if (scrollbarW > 0) root.style.paddingRight = `${scrollbarW}px`;
		}

		scrollLockCount += 1;
		let released = false;
		return () => {
			if (released) return;
			released = true;
			scrollLockCount = Math.max(0, scrollLockCount - 1);
			if (scrollLockCount === 0) {
				root.style.overflow = scrollLockPrev?.overflow ?? "";
				root.style.paddingRight = scrollLockPrev?.paddingRight ?? "";
				scrollLockPrev = null;
			}
		};
	};

	const forceResetOverlays = () => {
		try {
			document.querySelectorAll(".pt-sheet-overlay").forEach((el) => el.remove());
		} catch {
			// ignore
		}

		activeCloseStack = [];
		scrollLockCount = 0;
		const root = document.documentElement;
		root.style.overflow = scrollLockPrev?.overflow ?? "";
		root.style.paddingRight = scrollLockPrev?.paddingRight ?? "";
		scrollLockPrev = null;
	};

	const isHtml = (v) => typeof v === "string";

	/** Resolve the best origin element for the expand animation */
	const resolveTrigger = (explicit) => {
		if (explicit && typeof explicit.getBoundingClientRect === "function") {
			const r = explicit.getBoundingClientRect();
			if (r.width > 0 && r.height > 0) return explicit;
		}
		// Fallback: use the last element the user clicked/tapped
		if (_lastClickedEl && typeof _lastClickedEl.getBoundingClientRect === "function") {
			const r = _lastClickedEl.getBoundingClientRect();
			if (r.width > 0 && r.height > 0) return _lastClickedEl;
		}
		return null;
	};

	const open = async ({
		title = "",
		subtitle = "",
		meta = "",
		ariaLabel = "",
		html = "",
		closeText = "Cerrar",
		className = "",
		showClose = false,
		showHandle = false,
		allowOutsideClose = true,
		allowEscapeClose = true,
		allowDragClose = false,
		stack = false,
		didOpen,
		willClose,
		triggerEl = null,
	} = {}) => {
		// Resolve trigger BEFORE any async gap so _lastClickedEl is still fresh
		const resolvedTrigger = resolveTrigger(triggerEl);

		if (!isHtml(html)) html = String(html ?? "");

		if (!stack) {
			forceResetOverlays();
		}

		const unlock = lockScroll();

		const overlay = document.createElement("div");
		overlay.className = "pt-sheet-overlay";
		overlay.setAttribute("role", "presentation");
		overlay.style.setProperty("transition", "opacity 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)", "important");

		const sheet = document.createElement("section");
		sheet.className = `pt-sheet${className ? ` ${className}` : ""}`;
		sheet.setAttribute("role", "dialog");
		sheet.setAttribute("aria-modal", "true");
		if (ariaLabel) sheet.setAttribute("aria-label", ariaLabel);

		const titleId = `pt_sheet_title_${Math.random().toString(36).slice(2)}`;
		if (title) sheet.setAttribute("aria-labelledby", titleId);

		const header = document.createElement("header");
		header.className = "pt-sheet-header";

		const titleWrap = document.createElement("div");
		titleWrap.className = "pt-sheet-titlewrap";

		const h2 = document.createElement("h2");
		h2.className = "pt-sheet-title";
		h2.id = titleId;
		h2.textContent = title || "";
		if (!title) h2.classList.add("sr-only");

		const sub = document.createElement("div");
		sub.className = "pt-sheet-subtitle";
		sub.textContent = subtitle || meta || "";
		if (!subtitle && !meta) sub.classList.add("sr-only");

		const closeBtn = showClose
			? (() => {
				const btn = document.createElement("button");
				btn.type = "button";
				btn.className = "pt-sheet-close";
				btn.setAttribute("aria-label", closeText);
				btn.innerHTML = "<span aria-hidden=\"true\">×</span>";
				return btn;
			})()
			: null;

		titleWrap.appendChild(h2);
		titleWrap.appendChild(sub);
		header.appendChild(titleWrap);
		if (closeBtn) header.appendChild(closeBtn);

		const content = document.createElement("div");
		content.className = "pt-sheet-content";
		content.innerHTML = html;

		const backBtn = (() => {
			const btn = document.createElement("button");
			btn.type = "button";
			btn.className = "pt-sheet-back-btn";
			btn.setAttribute("aria-label", "Volver");
			btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; vertical-align: middle;"><path d="m15 18-6-6 6-6"/></svg><span style="vertical-align: middle;">Volver</span>`;
			return btn;
		})();

		sheet.appendChild(backBtn);
		sheet.appendChild(header);
		sheet.appendChild(content);
		overlay.appendChild(sheet);
		document.body.appendChild(overlay);

		let resolvePromise;
		const done = new Promise((resolve) => {
			resolvePromise = resolve;
		});

		let closed = false;
		let removeListeners = () => {};

		const close = () => {
			if (closed) return;
			closed = true;
			activeCloseStack = activeCloseStack.filter((fn) => fn !== close);

			try {
				if (typeof willClose === "function") willClose();
			} catch {
				// ignore
			}

			// ── Close animation: collapse back to origin ──
			let originRect = null;
			if (resolvedTrigger && typeof resolvedTrigger.getBoundingClientRect === "function") {
				const r = resolvedTrigger.getBoundingClientRect();
				if (r.width > 0 && r.height > 0) originRect = r;
			}

			if (originRect) {
				const lastRect = sheet.getBoundingClientRect();
				const deltaX = originRect.left + originRect.width / 2 - (lastRect.left + lastRect.width / 2);
				const deltaY = originRect.top + originRect.height / 2 - (lastRect.top + lastRect.height / 2);
				const scaleX = 0.05;
				const scaleY = 0.05;
				sheet.style.setProperty("transition", "transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.6s cubic-bezier(0.2, 0.8, 0.2, 1), border-radius 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)", "important");
				sheet.style.setProperty("transform", `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`, "important");
				sheet.style.opacity = "0";
				sheet.style.borderRadius = "16px";
			} else {
				sheet.style.setProperty("transition", "transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)", "important");
				sheet.style.setProperty("transform", "scale(0.85) translateY(20px)", "important");
				sheet.style.opacity = "0";
			}
			overlay.classList.remove("is-open");

			const finish = () => {
				removeListeners();
				try {
					overlay.remove();
				} catch {
					// ignore
				}
				try {
					unlock();
				} catch {
					// ignore
				}
				resolvePromise();
			};

			let t = null;
			const onEnd = (ev) => {
				if (ev && ev.target !== sheet) return;
				cleanup();
				finish();
			};
			const cleanup = () => {
				if (t) window.clearTimeout(t);
				sheet.removeEventListener("transitionend", onEnd);
			};
			sheet.addEventListener("transitionend", onEnd);
			t = window.setTimeout(() => {
				cleanup();
				finish();
			}, 700);
		};

		activeCloseStack.push(close);

		const onKeyDown = (ev) => {
			if (ev.key === "Escape") {
				if (!allowEscapeClose) return;
				ev.preventDefault();
				close();
				return;
			}

			if (ev.key !== "Tab") return;
			const focusables = Array.from(sheet.querySelectorAll(FOCUSABLE_SELECTOR)).filter((el) => {
				return el instanceof HTMLElement && !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true";
			});
			if (!focusables.length) return;
			const first = focusables[0];
			const last = focusables[focusables.length - 1];
			const active = document.activeElement;
			if (ev.shiftKey) {
				if (active === first || active === sheet) {
					ev.preventDefault();
					last.focus();
				}
			} else {
				if (active === last) {
					ev.preventDefault();
					first.focus();
				}
			}
		};

		const onOverlayClick = (ev) => {
			if (!allowOutsideClose) return;
			if (ev.target === overlay) close();
		};

		removeListeners = () => {
			document.removeEventListener("keydown", onKeyDown);
			overlay.removeEventListener("click", onOverlayClick);
			if (closeBtn) closeBtn.removeEventListener("click", close);
			backBtn.removeEventListener("click", close);
		};

		document.addEventListener("keydown", onKeyDown);
		overlay.addEventListener("click", onOverlayClick);
		if (closeBtn) closeBtn.addEventListener("click", close);
		backBtn.addEventListener("click", close);

		// ── Open animation: expand from origin ──
		if (resolvedTrigger) {
			const rect = resolvedTrigger.getBoundingClientRect();

			requestAnimationFrame(() => {
				overlay.classList.add("is-open");
			});

			sheet.style.opacity = "0";
			sheet.style.setProperty("transition", "none", "important");
			sheet.style.setProperty("transform", "none", "important");
			
			const lastRect = sheet.getBoundingClientRect();
			const deltaX = rect.left + rect.width / 2 - (lastRect.left + lastRect.width / 2);
			const deltaY = rect.top + rect.height / 2 - (lastRect.top + lastRect.height / 2);
			const scaleX = 0.05;
			const scaleY = 0.05;
			
			sheet.style.transformOrigin = "center center";
			sheet.style.setProperty("transform", `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`, "important");
			sheet.style.borderRadius = "16px";

			// Force reflow
			sheet.offsetHeight;

			requestAnimationFrame(() => {
				sheet.style.setProperty("transition", "transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.6s cubic-bezier(0.2, 0.8, 0.2, 1), border-radius 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)", "important");
				sheet.style.setProperty("transform", "none", "important");
				sheet.style.opacity = "1";
				sheet.style.borderRadius = "24px";
			});
		} else {
			requestAnimationFrame(() => {
				overlay.classList.add("is-open");
			});

			sheet.style.opacity = "0";
			sheet.style.setProperty("transform", "scale(0.85) translateY(30px)", "important");
			sheet.style.setProperty("transition", "none", "important");
			
			sheet.offsetHeight;
			
			requestAnimationFrame(() => {
				sheet.style.setProperty("transition", "transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)", "important");
				sheet.style.setProperty("transform", "none", "important");
				sheet.style.opacity = "1";
			});
		}

		setTimeout(() => {
			try {
				sheet.setAttribute("tabindex", "-1");
				sheet.focus();
			} catch {
				// ignore
			}
		}, 0);

		try {
			if (typeof didOpen === "function") didOpen(sheet);
		} catch {
			// ignore
		}

		await done;
	};

	const close = () => {
		try {
			const top = activeCloseStack[activeCloseStack.length - 1];
			if (typeof top === "function") top();
		} catch {
			// ignore
		}
	};

	window.PTBottomSheet = { open, close };
})();
