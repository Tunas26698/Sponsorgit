// Initialize Lucide Icons
lucide.createIcons();

function focusWaitlist() {
    const emailInput = document.getElementById('email-input');
    emailInput.focus();
}

function submitWaitlist() {
    const email = document.getElementById('email-input').value;
    const type = document.getElementById('user-type').value;
    const btn = document.getElementById('submit-btn');
    const feedback = document.getElementById('form-feedback');
    
    // Simulate loading state
    const originalText = btn.innerHTML;
    btn.innerHTML = `<i data-lucide="loader-2" class="spin"></i> Submitting...`;
    btn.disabled = true;
    lucide.createIcons();

    // Fake API Call delay
    setTimeout(() => {
        btn.innerHTML = originalText;
        btn.disabled = false;
        lucide.createIcons();
        
        document.getElementById('email-input').value = '';
        
        if(type === 'maintainer') {
            feedback.innerHTML = "You're on the list! We'll notify you when beta access opens.";
        } else {
            feedback.innerHTML = "Request sent. Our partnership team will contact you shortly.";
        }
        
    }, 1200);
}

// Add a simple spin animation class dynamically (or append to stylesheet)
const style = document.createElement('style');
style.innerHTML = `
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { 100% { transform: rotate(360deg); } }
`;
document.head.appendChild(style);
