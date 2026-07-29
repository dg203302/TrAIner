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
			background: rgba(0, 0, 0, 0.6) !important;
			z-index: 2000 !important;
			display: flex !important;
			align-items: center !important;
			justify-content: center !important;
			opacity: 0 !important;
			pointer-events: none !important;
			transition: opacity 0.2s ease !important;
		}
		.pt-sheet-overlay.is-open {
			opacity: 1 !important;
			pointer-events: auto !important;
		}
		.pt-sheet {
			position: relative !important;
			width: 98% !important;
			max-width: 500px !important;
			max-height: 90vh !important;
			background: #1a1d22 !important;
			border: none !important;
			border-radius: 24px !important;
			box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5) !important;
			display: flex !important;
			flex-direction: column !important;
			overflow: hidden !important;
			margin: 0 !important;
			bottom: auto !important;
			transform: scale(0.97) translateY(20px) !important;
			opacity: 0 !important;
			transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease !important;
		}
		.pt-sheet-overlay.is-open .pt-sheet {
			transform: scale(1) translateY(0) !important;
			opacity: 1 !important;
		}
		.pt-sheet:has(.pt-new-detail),
		.pt-sheet.pt-new-detail-sheet {
			border: none !important;
			background: #1a1d22 !important;
			box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5) !important;
		}
		.pt-sheet:has(.pt-new-detail) .pt-sheet-header,
		.pt-sheet.pt-new-detail-sheet .pt-sheet-header {
			display: none !important;
		}
		.pt-sheet:has(.pt-new-detail) .pt-sheet-content,
		.pt-sheet.pt-new-detail-sheet .pt-sheet-content {
			padding: 48px 0 0 0 !important;
		}
		@media (min-width: 768px) {
			.pt-sheet.pt-new-detail-sheet,
			.pt-sheet:has(.pt-new-detail) {
				max-width: 900px !important;
				max-height: 85vh !important;
			}
		}
		@media (max-width: 767px) {
			.pt-sheet-overlay {
				align-items: flex-end !important;
				padding: 0 !important;
			}
			.pt-sheet {
				width: 100% !important;
				max-width: 100% !important;
				border-radius: 24px 24px 0 0 !important;
				transform: translateY(100%) !important;
			}
			.pt-sheet-overlay.is-open .pt-sheet {
				transform: translateY(0) !important;
			}
			.pt-sheet-content {
				padding-bottom: calc(16px + env(safe-area-inset-bottom)) !important;
			}
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
			background: #242830 !important;
			border: none !important;
			color: #ffffff !important;
			width: 32px !important;
			height: 32px !important;
			border-radius: 50% !important;
			display: flex !important;
			align-items: center !important;
			justify-content: center !important;
			cursor: pointer !important;
			transition: all 0.2s ease !important;
			font-size: 18px !important;
			line-height: 1 !important;
			padding: 0 !important;
			margin: 0 !important;
			text-shadow: none !important;
			flex-shrink: 0 !important;
		}
		.pt-sheet-close:hover {
			background: #2a2f38 !important;
		}
		.pt-sheet-close:active {
			transform: scale(0.95) !important;
		}
		.pt-sheet-content {
			flex: 1 !important;
			overflow-y: auto !important;
			padding: 48px 16px 16px 16px !important;
			-webkit-overflow-scrolling: touch !important;
		}
		.pt-sheet-top-actions {
			display: flex !important;
			flex-direction: column-reverse !important;
			gap: 12px !important;
			padding: 16px 24px !important;
			background: #1a1d22 !important;
			border-top: 1px solid rgba(255, 255, 255, 0.05) !important;
			z-index: 2100 !important;
			pointer-events: auto !important;
			width: 100% !important;
			box-sizing: border-box !important;
		}
		@media (max-width: 767px) {
			.pt-sheet-top-actions {
				padding: 16px 16px calc(16px + env(safe-area-inset-bottom)) 16px !important;
			}
		}
		.pt-sheet-back-btn, .pt-sheet-action-btn {
			border: none !important;
			padding: 12px 18px !important;
			border-radius: 14px !important;
			font-size: 15px !important;
			font-weight: 700 !important;
			display: inline-flex !important;
			align-items: center !important;
			justify-content: center !important;
			gap: 6px !important;
			cursor: pointer !important;
			transition: all 0.2s ease !important;
			pointer-events: auto !important;
			box-shadow: none !important;
			width: 100% !important;
			box-sizing: border-box !important;
		}
		.pt-sheet-action-btn {
			background: #6b52ff !important;
			color: #ffffff !important;
		}
		.pt-sheet-action-btn:hover {
			filter: brightness(1.1) !important;
		}
		.pt-sheet-back-btn {
			background: #242830 !important;
			color: #a49d97 !important;
		}
		.pt-sheet-back-btn:hover {
			background: #2a2f38 !important;
			color: #ffffff !important;
		}
		.pt-sheet-back-btn:active, .pt-sheet-action-btn:active {
			transform: scale(0.98) !important;
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
		showBack = true,
		extraTopBtn = null,
		allowOutsideClose = true,
		allowEscapeClose = true,
		allowDragClose = false,
		stack = false,
		didOpen,
		willClose,
		triggerEl = null,
		hideAd = false,
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

		// Adsterra Banner Banner (Iframe to prevent document.write issues)
		const adIframe = document.createElement("iframe");
		adIframe.style.width = "100%";
		adIframe.style.aspectRatio = "728 / 90";
		adIframe.style.maxHeight = "90px";
		adIframe.style.border = "none";
		adIframe.style.overflow = "hidden";
		adIframe.style.marginBottom = "16px";
		adIframe.scrolling = "no";
		adIframe.srcdoc = `
			<!DOCTYPE html>
			<html>
			<head>
				<style>
					body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; background: transparent; overflow: hidden; }
					#scale-wrap { transform: scale(min(1, calc(100vw / 728))); transform-origin: center center; }
				</style>
			</head>
			<body>
				<div id="scale-wrap">
					<script>
					  atOptions = {
						'key' : '20fd356d9c7b90b05c268f07099b182f',
						'format' : 'iframe',
						'height' : 90,
						'width' : 728,
						'params' : {}
					  };
					</script>
					<script src="https://www.highperformanceformat.com/20fd356d9c7b90b05c268f07099b182f/invoke.js"></script>
				</div>
			</body>
			</html>
		`;
		
		const htmlWrap = document.createElement("div");
		htmlWrap.innerHTML = html;

		if (!hideAd) {
			content.appendChild(adIframe);
		}
		content.appendChild(htmlWrap);

		const topActionsWrap = document.createElement("div");
		topActionsWrap.className = "pt-sheet-top-actions";

		const backBtn = showBack
			? (() => {
				const btn = document.createElement("button");
				btn.type = "button";
				btn.className = "pt-sheet-back-btn";
				btn.setAttribute("aria-label", "Volver");
				btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; vertical-align: middle;"><path d="m15 18-6-6 6-6"/></svg><span style="vertical-align: middle;">Volver</span>`;
				return btn;
			})()
			: null;

		let extraBtnEl = null;
		if (extraTopBtn) {
			extraBtnEl = document.createElement("button");
			extraBtnEl.type = "button";
			extraBtnEl.className = "pt-sheet-action-btn";
			if (extraTopBtn.ariaLabel) extraBtnEl.setAttribute("aria-label", extraTopBtn.ariaLabel);
			extraBtnEl.innerHTML = extraTopBtn.html || "";
			if (typeof extraTopBtn.onClick === "function") {
				extraBtnEl.addEventListener("click", extraTopBtn.onClick);
			}
		}

		if (backBtn) topActionsWrap.appendChild(backBtn);
		if (extraBtnEl) topActionsWrap.appendChild(extraBtnEl);

		sheet.appendChild(header);
		sheet.appendChild(content);
		if (backBtn || extraBtnEl) {
			sheet.appendChild(topActionsWrap);
		}
		overlay.appendChild(sheet);

		let resolvePromise;
		const done = new Promise((resolve) => {
			resolvePromise = resolve;
		});

		let closed = false;
		let removeListeners = () => { };

		const close = () => {
			if (closed) return;
			closed = true;
			activeCloseStack = activeCloseStack.filter((fn) => fn !== close);

			try {
				if (typeof willClose === "function") willClose();
			} catch {
				// ignore
			}

			const finish = () => {
				removeListeners();
				try { overlay.remove(); } catch { }
				try { unlock(); } catch { }
				resolvePromise();
			};

			overlay.classList.remove("is-open");
			setTimeout(finish, 200);
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
			if (backBtn) backBtn.removeEventListener("click", close);
		};

		document.addEventListener("keydown", onKeyDown);
		overlay.addEventListener("click", onOverlayClick);
		if (closeBtn) closeBtn.addEventListener("click", close);
		if (backBtn) backBtn.addEventListener("click", close);

		document.body.appendChild(overlay);
		overlay.offsetHeight; // force reflow
		overlay.classList.add("is-open");

		setTimeout(() => {
			try {
				sheet.setAttribute("tabindex", "-1");
				sheet.focus({ preventScroll: true });
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

	// Floating footer and sticky title logic
	const updateScrollStates = () => {
		// Sticky title floating logic
		const mainTitle = document.querySelector('.dynamic-title');
		if (mainTitle) {
			if (window.scrollY > 20) {
				mainTitle.classList.add('is-scrolled');
			} else {
				mainTitle.classList.remove('is-scrolled');
			}
		}
	};

	window.addEventListener('scroll', updateScrollStates, { passive: true });
	window.addEventListener('resize', updateScrollStates, { passive: true });

	const domObserver = new MutationObserver(updateScrollStates);
	domObserver.observe(document.body, { childList: true, subtree: true });

	setTimeout(updateScrollStates, 100);
})();
