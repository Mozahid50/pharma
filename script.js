/* ==========================================
   HOME PAGE - ONE TIME SCROLL REVEAL
   ========================================== */

document.addEventListener("DOMContentLoaded", function () {

    const revealElements = document.querySelectorAll(
        "main .hero, main .dashboard-group, main .about-section, main .contact-section"
    );

    if (!("IntersectionObserver" in window)) {
        revealElements.forEach(element => {
            element.classList.add("reveal-active");
        });
        return;
    }

    const revealObserver = new IntersectionObserver(
        (entries, observer) => {

            entries.forEach(entry => {

                if (entry.isIntersecting) {

                    entry.target.classList.add("reveal-active");

                    // Animate only once
                    observer.unobserve(entry.target);
                }

            });

        },
        {
            threshold: 0.12,
            rootMargin: "0px 0px -40px 0px"
        }
    );

    revealElements.forEach(element => {
        revealObserver.observe(element);
    });

});


/* =====================================
   ABOUT SECTION - ONE TIME REVEAL
===================================== */

document.addEventListener("DOMContentLoaded", function () {

    const aboutElements = document.querySelectorAll(
        ".about-section .about-main-card, " +
        ".about-section .about-top, " +
        ".about-section .about-step, " +
        ".about-section .about-card-footer"
    );

    if (!("IntersectionObserver" in window)) {
        aboutElements.forEach(element => {
            element.classList.add("about-revealed");
        });
        return;
    }

    const aboutObserver = new IntersectionObserver(
        (entries, observer) => {

            entries.forEach(entry => {

                if (entry.isIntersecting) {

                    entry.target.classList.add("about-revealed");

                    observer.unobserve(entry.target);
                }

            });

        },
        {
            threshold: 0.15
        }
    );

    aboutElements.forEach((element, index) => {

        element.style.animationDelay = `${index * 0.15}s`;

        aboutObserver.observe(element);

    });

});


/* PharmaGuard Pro - Mobile Menu Auto Close */

document.addEventListener("DOMContentLoaded", function () {

    const menuToggle = document.querySelector("#menu-toggle");
    const navbar = document.querySelector(".navbar");
    const navMenu = document.querySelector(".nav-menu");

    if (!menuToggle || !navbar || !navMenu) return;

    // Menu link click করলে বন্ধ হবে
    navMenu.querySelectorAll("a").forEach(function (link) {
        link.addEventListener("click", function () {
            menuToggle.checked = false;
        });
    });

    // Menu-এর বাইরে ক্লিক করলে বন্ধ হবে
    document.addEventListener("click", function (event) {

        if (
            menuToggle.checked &&
            !navbar.contains(event.target)
        ) {
            menuToggle.checked = false;
        }

    });

    // Escape চাপলে বন্ধ হবে
    document.addEventListener("keydown", function (event) {

        if (event.key === "Escape") {
            menuToggle.checked = false;
        }

    });

});


function togglePosMenu() {
    const menu = document.getElementById("posMenu");

    menu.classList.toggle("active");
}

// Click outside to close POS menu

document.addEventListener("click", function(event) {

    const container = document.querySelector(
        ".floating-pos-container"
    );

    const menu = document.getElementById("posMenu");

    if (!container.contains(event.target)) {
        menu.classList.remove("active");
    }

});