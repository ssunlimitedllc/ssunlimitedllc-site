
// =========================================
// Mobile Navigation Menu
// =========================================

const menuButton = document.getElementById("menuBtn");
const mobileMenu = document.getElementById("mobileMenu");

if (menuButton && mobileMenu) {
  const menuIcon = menuButton.querySelector(".menu-icon");
  const menuLabel = menuButton.querySelector(".menu-label");

  function setMobileMenu(open) {
    mobileMenu.hidden = !open;
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute(
      "aria-label",
      open ? "Close navigation menu" : "Open navigation menu"
    );

    if (menuIcon) menuIcon.textContent = open ? "✕" : "☰";
    if (menuLabel) menuLabel.textContent = open ? "Close" : "Menu";
  }

  setMobileMenu(false);

  menuButton.addEventListener("click", () => {
    setMobileMenu(mobileMenu.hidden);
  });

  mobileMenu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setMobileMenu(false));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !mobileMenu.hidden) {
      setMobileMenu(false);
      menuButton.focus();
    }
  });

  document.addEventListener("click", (event) => {
    if (
      !mobileMenu.hidden &&
      !mobileMenu.contains(event.target) &&
      !menuButton.contains(event.target)
    ) {
      setMobileMenu(false);
    }
  });

  window.matchMedia("(min-width: 851px)").addEventListener("change", (event) => {
    if (event.matches) setMobileMenu(false);
  });
}



// =========================================
// V3 — Preselect Inquiry Type
// =========================================

document.querySelectorAll("[data-inquiry]").forEach((link) => {

  link.addEventListener("click", () => {

    const inquiryType = document.getElementById("inquiryType");

    if (inquiryType) {
      inquiryType.value = link.dataset.inquiry;
    }

  });

});

// =========================================
// V3 — Secure Contact Form Submission
// =========================================


const leadForm = document.getElementById("leadForm");

if (leadForm) {
  const submitButton = leadForm.querySelector('button[type="submit"]');
  const formStatus = document.getElementById("formStatus");

  let isSubmitting = false;

  function getTurnstileToken() {
    return (
      leadForm.querySelector('[name="cf-turnstile-response"]')?.value || ""
    );
  }

  function updateSubmitButton() {
    if (!submitButton) return;

    submitButton.disabled =
      isSubmitting || !getTurnstileToken();
  }

  function resetVerification() {
    if (window.turnstile) {
      window.turnstile.reset();
    }

    updateSubmitButton();
  }

  // Enable submission only after Turnstile provides a token.
  window.onContactTurnstileSuccess = function () {
    updateSubmitButton();
  };

  window.onContactTurnstileExpired = function () {
    updateSubmitButton();
  };

  window.onContactTurnstileError = function () {
    if (formStatus) {
      formStatus.textContent =
        "Security verification failed. Please try again.";
    }

    updateSubmitButton();
  };

  updateSubmitButton();

  leadForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (isSubmitting || !submitButton) return;

    const turnstileToken = getTurnstileToken();

    if (!turnstileToken) {
      if (formStatus) {
        formStatus.textContent =
          "Please complete the security verification.";
      }
      updateSubmitButton();
      return;
    }

    if (!leadForm.reportValidity()) return;

    isSubmitting = true;
    submitButton.disabled = true;
    submitButton.textContent = "Sending...";

    if (formStatus) {
      formStatus.textContent = "Submitting your inquiry...";
    }

    const payload = {
      inquiryType: document.getElementById("inquiryType")?.value || "",
      name: leadForm.querySelector('[name="name"]')?.value || "",
      email: leadForm.querySelector('[name="email"]')?.value || "",
      company: leadForm.querySelector('[name="company"]')?.value || "",
      message: leadForm.querySelector('[name="message"]')?.value || "",
      websiteUrl: document.getElementById("websiteUrl")?.value || "",
      turnstileToken
    };

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Unable to submit your inquiry."
        );
      }

      if (formStatus) {
        formStatus.textContent =
          "Your inquiry was accepted for delivery. We'll be in touch!";
      }

      // Clear all fields after a successful response,
      leadForm.reset();
    }
    catch (error) {
      if (formStatus) {
        formStatus.textContent =
          error.message ||
          "Unable to submit. Please email us directly.";
      }

    } finally {
      isSubmitting = false;
      submitButton.textContent = "Send Inquiry →";
      resetVerification();
    }
  });
}
