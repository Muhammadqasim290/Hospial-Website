/* appointments.js
 - Renders doctor cards (from user-specified list)
 - Shows booking modal immediately when 'Book' is clicked
 - Modal includes Login & Sign Up options (link to login.html)
 - If the user is logged in (Supabase session) appointment will be saved to Supabase if keys set,
   otherwise saved to localStorage as fallback.
 - Replace SUPABASE_URL and SUPABASE_ANON_KEY placeholders with your real keys to enable DB storage.
*/

// ---------- CONFIG (replace with your Supabase values) ----------
const SUPABASE_URL = "https://YOUR-PROJECT.supabase.co";
const SUPABASE_ANON_KEY = "YOUR-ANON-KEY";

// init supabase client if keys provided (otherwise null)
let supabase = null;
if (!SUPABASE_URL.includes("YOUR-PROJECT")) {
  supabase = supabase = supabase = supabase || window.supabase?.createClient
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;
} else {
  // keys not set — we'll use localStorage fallback
  supabase = null;
}

// ---------- Example doctor data (dates in ISO format) ----------
const DOCTORS = [
  { id: "dr-emily", name: "Dr. Emily Carter", specialty: "Cardiology", times: "9:00 AM - 1:00 PM", dates: ["2025-11-10", "2025-11-12"], days: ["Monday","Wednesday"] },
  { id: "dr-david", name: "Dr. David Kim", specialty: "Orthopedics", times: "2:00 PM - 5:00 PM", dates: ["2025-11-11", "2025-11-13"], days: ["Tuesday","Thursday"] },
  { id: "dr-syeda", name: "Dr. Syeda Maria Hurair", specialty: "Pediatrics", times: "10:00 AM - 12:00 PM", dates: ["2025-11-14", "2025-11-15"], days: ["Friday","Saturday"] },
  { id: "dr-alex", name: "Dr. Alex Chen", specialty: "Cardiology", times: "1:00 PM - 3:00 PM", dates: ["2025-11-16", "2025-11-17"], days: ["Sunday","Monday"] },
  { id: "dr-sarah", name: "Dr. Sarah Khan", specialty: "Dentist", times: "8:30 AM - 11:30 AM", dates: ["2025-11-18", "2025-11-19"], days: ["Tuesday","Wednesday"] },
];

// ---------- Utilities ----------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function formatDateISOToReadable(iso) {
  const dt = new Date(iso + "T00:00:00");
  return dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// ---------- Render doctor cards ----------
const grid = document.getElementById("doctors-grid");
DOCTORS.forEach(doc => {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <h4>${doc.name}</h4>
    <div class="muted">${doc.specialty}</div>
    <p>Time: ${doc.times}</p>
    <p>Dates: ${doc.dates.map(d => formatDateISOToReadable(d)).join(", ")}</p>
    <p>Days: ${doc.days.join(", ")}</p>
    <div style="margin-top:10px;">
      <button class="btn-primary book-btn" data-id="${doc.id}">Book</button>
    </div>
  `;
  grid.appendChild(card);
});

// ---------- Modal logic ----------
const modal = document.getElementById("booking-modal");
const modalClose = document.getElementById("modal-close");
const modalDoctorName = document.getElementById("modal-doctor-name");
const modalDoctorSpecialty = document.getElementById("modal-doctor-specialty");
const apptDateInput = document.getElementById("appt-date");
const apptTimeInput = document.getElementById("appt-time");
const apptNotes = document.getElementById("appt-notes");
const bookingFeedback = document.getElementById("booking-feedback");
const confirmBtn = document.getElementById("confirm-booking");
const cancelBtn = document.getElementById("cancel-booking");
const authPrompt = document.getElementById("auth-prompt");

let currentDoctor = null;

// Open modal when book clicked
grid.addEventListener("click", (e) => {
  const bookBtn = e.target.closest(".book-btn");
  if (!bookBtn) return;
  const docId = bookBtn.dataset.id;
  currentDoctor = DOCTORS.find(d => d.id === docId);
  if (!currentDoctor) return;
  // populate modal
  modalDoctorName.textContent = currentDoctor.name;
  modalDoctorSpecialty.textContent = `${currentDoctor.specialty} • ${currentDoctor.times}`;
  bookingFeedback.textContent = "";
  apptNotes.value = "";
  // set date input defaults & restrictions (min/max from doctor's dates)
  const min = currentDoctor.dates[0];
  const max = currentDoctor.dates[currentDoctor.dates.length - 1];
  apptDateInput.min = min;
  apptDateInput.max = max;
  apptDateInput.value = min; // default
  apptTimeInput.value = ""; // must pick
  // Show modal immediately
  modal.className = "modal-visible";
  modal.setAttribute("aria-hidden", "false");
  // If user is logged in, hide auth prompt
  checkSession().then(user => {
    if (user) {
      authPrompt.style.display = "none";
    } else {
      authPrompt.style.display = "block";
    }
  });
});

// Close
modalClose.addEventListener("click", () => closeModal());
cancelBtn.addEventListener("click", () => closeModal());
function closeModal() {
  modal.className = "modal-hidden";
  modal.setAttribute("aria-hidden", "true");
  currentDoctor = null;
}

// Check supabase session
async function checkSession() {
  try {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session?.user ?? null;
  } catch (err) {
    return null;
  }
}

// Save appointment: try Supabase insert, otherwise localStorage fallback
async function saveAppointmentRecord(record) {
  // If supabase configured, insert into 'appointments' table (you must create this table)
  if (supabase) {
    try {
      const { error } = await supabase.from("appointments").insert(record);
      if (error) throw error;
      return { ok: true, source: "supabase" };
    } catch (err) {
      console.warn("Supabase insert failed, falling back to localStorage:", err.message);
    }
  }
  // localStorage fallback
  const list = JSON.parse(localStorage.getItem("appointments") || "[]");
  list.push(record);
  localStorage.setItem("appointments", JSON.stringify(list));
  return { ok: true, source: "local" };
}

// On confirm click
confirmBtn.addEventListener("click", async () => {
  bookingFeedback.textContent = "";
  if (!currentDoctor) {
    bookingFeedback.textContent = "No doctor selected.";
    return;
  }
  const date = apptDateInput.value;
  const time = apptTimeInput.value;
  const notes = apptNotes.value.trim();
  if (!date || !time) {
    bookingFeedback.textContent = "Please choose date and time.";
    return;
  }
  // Validate chosen date within doctor's available dates
  if (!currentDoctor.dates.includes(date)) {
    bookingFeedback.textContent = "Selected date is not available for this doctor. Please choose one of the suggested dates.";
    return;
  }

  // Compose appointment record
  const user = await checkSession();
  const appt = {
    id: "appt_" + Date.now(),
    doctor_id: currentDoctor.id,
    doctor_name: currentDoctor.name,
    specialty: currentDoctor.specialty,
    date,
    time,
    notes,
    created_at: new Date().toISOString(),
    user_id: user ? user.id : null,
    user_email: user ? user.email : (localStorage.getItem("userEmail") || null),
  };

  // Save
  bookingFeedback.textContent = "Saving appointment...";
  const res = await saveAppointmentRecord(appt);
  if (res.ok) {
    bookingFeedback.textContent = `Appointment confirmed (${res.source}). ${user ? "You can see it in My Appointments." : "Sign in to save it to your account."}`;
    // small visual confirmation then close
    setTimeout(() => closeModal(), 1400);
  } else {
    bookingFeedback.textContent = "Failed to save appointment. Try again.";
  }
});

// Close modal on outside click
window.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});

// Simple login-btn text change (uses localStorage as quick indicator)
document.addEventListener("DOMContentLoaded", async () => {
  const loginBtn = document.getElementById("login-btn");
  const supUser = await checkSession();
  if (supUser) {
    loginBtn.textContent = supUser.email;
    loginBtn.href = "my-appointments.html";
  } else {
    const storedEmail = localStorage.getItem("userEmail");
    if (storedEmail) {
      loginBtn.textContent = storedEmail;
      loginBtn.href = "my-appointments.html";
    } else {
      loginBtn.textContent = "Login";
      loginBtn.href = "login.html";
    }
  }
});
