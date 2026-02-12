import { auth, db } from './firebase-config.js';
import { doc, getDoc, collection, addDoc, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

let courseId = null;
let courseData = null;
let isEnrolled = false;

// Get course ID from URL
function getCourseId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

// Load course details
async function loadCourseDetails() {
    courseId = getCourseId();
    if (!courseId) {
        window.location.href = 'courses.html';
        return;
    }

    const contentDiv = document.getElementById('courseContent');

    try {
        const courseDoc = await getDoc(doc(db, 'courses', courseId));
        
        if (!courseDoc.exists()) {
            contentDiv.innerHTML = '<div class="container"><p class="loading">Course not found.</p></div>';
            return;
        }

        courseData = courseDoc.data();

        // Check if user is enrolled
        if (auth.currentUser) {
            await checkEnrollment();
        }

        displayCourseDetails();
    } catch (error) {
        console.error('Error loading course:', error);
        contentDiv.innerHTML = '<div class="container"><p class="loading">Error loading course details.</p></div>';
    }
}

async function checkEnrollment() {
    try {
        const enrollmentsRef = collection(db, 'enrollments');
        const q = query(
            enrollmentsRef,
            where('userId', '==', auth.currentUser.uid),
            where('courseId', '==', courseId)
        );
        const querySnapshot = await getDocs(q);
        isEnrolled = !querySnapshot.empty;
    } catch (error) {
        console.error('Error checking enrollment:', error);
    }
}

function displayCourseDetails() {
    const contentDiv = document.getElementById('courseContent');
    const lessonCount = courseData.lessons ? courseData.lessons.length : 0;
    const totalDuration = courseData.lessons 
        ? courseData.lessons.reduce((sum, lesson) => sum + (lesson.duration || 0), 0)
        : 0;

    const enrollButton = isEnrolled 
        ? '<a href="lesson.html?courseId=' + courseId + '&lessonIndex=0" class="btn btn-primary btn-full">Continue Learning</a>'
        : '<button id="enrollBtn" class="btn btn-primary btn-full">Enroll Now - $' + courseData.price + '</button>';

    const curriculumHTML = courseData.lessons && courseData.lessons.length > 0
        ? courseData.lessons.map((lesson, index) => `
            <li class="curriculum-item">
                <div class="lesson-info">
                    <h4>${index + 1}. ${lesson.title}</h4>
                    <span>${lesson.duration} minutes</span>
                </div>
                ${isEnrolled ? '<i class="fas fa-play-circle"></i>' : '<i class="fas fa-lock"></i>'}
            </li>
        `).join('')
        : '<li class="curriculum-item"><p>No lessons available yet.</p></li>';

    contentDiv.innerHTML = `
        <section class="course-detail-header">
            <div class="container">
                <h1>${courseData.title}</h1>
                <p>${courseData.description}</p>
                <div class="course-detail-meta">
                    <span>
                        <i class="fas fa-user"></i>
                        ${courseData.instructor}
                    </span>
                    <span>
                        <i class="fas fa-folder"></i>
                        ${courseData.category}
                    </span>
                    <span>
                        <i class="fas fa-play-circle"></i>
                        ${lessonCount} Lessons
                    </span>
                    <span>
                        <i class="fas fa-clock"></i>
                        ${totalDuration} Minutes
                    </span>
                </div>
            </div>
        </section>

        <section class="course-detail">
            <div class="container">
                <div class="course-detail-content">
                    <div class="course-main">
                        <h2>What You'll Learn</h2>
                        <p>${courseData.description}</p>

                        <h2 style="margin-top: 2rem;">Course Curriculum</h2>
                        <ul class="curriculum-list">
                            ${curriculumHTML}
                        </ul>
                    </div>

                    <div class="course-sidebar">
                        ${isEnrolled ? '<span class="enrolled-badge"><i class="fas fa-check-circle"></i> Enrolled</span>' : ''}
                        <img src="${courseData.thumbnail || 'https://via.placeholder.com/400x300'}" alt="${courseData.title}" style="width: 100%; border-radius: 0.5rem; margin-bottom: 1rem;">
                        <h3 style="margin-bottom: 0.5rem;">$${courseData.price}</h3>
                        ${enrollButton}
                        
                        <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border-color);">
                            <h4>This course includes:</h4>
                            <ul style="list-style: none; margin-top: 1rem;">
                                <li style="margin-bottom: 0.5rem;">
                                    <i class="fas fa-play-circle"></i>
                                    ${lessonCount} video lessons
                                </li>
                                <li style="margin-bottom: 0.5rem;">
                                    <i class="fas fa-clock"></i>
                                    ${totalDuration} minutes of content
                                </li>
                                <li style="margin-bottom: 0.5rem;">
                                    <i class="fas fa-mobile-alt"></i>
                                    Access on mobile and desktop
                                </li>
                                <li style="margin-bottom: 0.5rem;">
                                    <i class="fas fa-infinity"></i>
                                    Lifetime access
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    `;

    // Add enroll button handler
    const enrollBtn = document.getElementById('enrollBtn');
    if (enrollBtn) {
        enrollBtn.addEventListener('click', handleEnrollment);
    }
}

async function handleEnrollment() {
    if (!auth.currentUser) {
        alert('Please login to enroll in this course.');
        window.location.href = 'login.html';
        return;
    }

    const enrollBtn = document.getElementById('enrollBtn');
    enrollBtn.disabled = true;
    enrollBtn.textContent = 'Enrolling...';

    try {
        // Create enrollment
        await addDoc(collection(db, 'enrollments'), {
            userId: auth.currentUser.uid,
            courseId: courseId,
            enrolledAt: new Date(),
            progress: 0,
            completedLessons: []
        });

        // Create initial progress document
        await addDoc(collection(db, 'progress'), {
            userId: auth.currentUser.uid,
            courseId: courseId,
            completedLessons: [],
            lastAccessedLesson: 0,
            updatedAt: new Date()
        });

        alert('Successfully enrolled! Redirecting to course...');
        window.location.href = `lesson.html?courseId=${courseId}&lessonIndex=0`;
    } catch (error) {
        console.error('Error enrolling:', error);
        alert('Error enrolling in course. Please try again.');
        enrollBtn.disabled = false;
        enrollBtn.textContent = `Enroll Now - $${courseData.price}`;
    }
}

// Initialize
onAuthStateChanged(auth, () => {
    loadCourseDetails();
});
