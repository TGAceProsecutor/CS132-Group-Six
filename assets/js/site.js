(() => {
	const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const nav = document.getElementById('nav');
	const toggle = nav.querySelector('.nav-toggle');
	const links = [...nav.querySelectorAll('.nav-links a')];

	// sticky nav: solid once the page leaves the top
	const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 24);
	onScroll();
	window.addEventListener('scroll', onScroll, { passive: true });

	// mobile menu
	const setOpen = (open) => {
		nav.classList.toggle('is-open', open);
		toggle.setAttribute('aria-expanded', String(open));
	};
	toggle.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
	links.forEach((a) => a.addEventListener('click', () => setOpen(false)));
	document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });

	// current section in the nav
	const byId = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
	const spy = new IntersectionObserver((entries) => {
		entries.forEach((e) => {
			if (!e.isIntersecting) return;
			links.forEach((a) => a.classList.remove('is-active'));
			byId.get(e.target.id)?.classList.add('is-active');
		});
	}, { rootMargin: '-45% 0px -50% 0px' });
	byId.forEach((_, id) => { const el = document.getElementById(id); if (el) spy.observe(el); });

	if (!('IntersectionObserver' in window) || reduce) return;

	// dataset figures count up once, ending on the exact figure written in the page
	const counters = document.querySelectorAll('.num[data-count]');
	const countUp = (el) => {
		const end = Number(el.dataset.count);
		const t0 = performance.now(), dur = 1400;
		const tick = (t) => {
			const p = Math.min(1, (t - t0) / dur);
			el.textContent = String(Math.round(end * (1 - Math.pow(1 - p, 3))));
			if (p < 1) requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
	};
	const statIO = new IntersectionObserver((entries, io) => {
		entries.forEach((e) => {
			if (!e.isIntersecting) return;
			countUp(e.target);
			io.unobserve(e.target);
		});
	}, { threshold: 0.6 });
	counters.forEach((el) => statIO.observe(el));

	// methodology line draws across once
	const steps = document.querySelector('.steps');
	if (steps) {
		const stepIO = new IntersectionObserver((entries, io) => {
			if (entries[0].isIntersecting) { steps.classList.add('is-drawn'); io.disconnect(); }
		}, { threshold: 0.4 });
		stepIO.observe(steps);
	}
})();
