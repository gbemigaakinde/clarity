import { auth, db } from './firebase-config.js';
import { collection, query, where, getDocs, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { requireAuth } from './auth.js';

// Initialize dashboard
async function initDashboard() {
    await requireAuth();
    
    loadEnrolledCourses();
    loadUserProfile();
    setupTabs();
}

// Setup tabs
function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;

            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(targetTab + 'Tab').classList.add('active');
        });
    });
}

// Load enrolled courses
async function loadEnrolledCourses() {
    const grid = document.getElementById('enrolledCourses');
    
    try {
        // Get user's enrollments
        const enrollmentsRef = collection(db, 'enrollments');
        const q = query(enrollmentsRef, where('userId', '==', auth.currentUser.uid));
        const enrollmentsSnapshot = await getDocs(q);

        if (enrollmentsSnapshot.empty) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                    <i class="fas fa-book" style="font-size: 3rem; color: var(--text-secondary); margin-bottom: 1rem;"></i>
                    <h3>No Courses Yet</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">Start learning by enrolling in a course</p>
                    <a href="courses.html" class="btn btn-primary">Browse Courses</a>
                </div>
            `;
            return;
        }

        // Get course IDs
        const courseIds = [];
        const enrollmentMap = {};
        enrollmentsSnapshot.forEach((doc) => {
            const enrollment = doc.data();
            courseIds.push(enrollment.courseId);
            enrollmentMap[enrollment.courseId] = enrollment;
        });

        // Fetch courses
        grid.innerHTML = '';
        for (const courseId of courseIds) {
            const courseDoc = await getDoc(doc(db, 'courses', courseId));
            if (courseDoc.exists()) {
                const course = courseDoc.data();
                const enrollment = enrollmentMap[courseId];
                
                // Get progress
                const progressRef = collection(db, 'progress');
                const progressQuery = query(
                    progressRef,
                    where('userId', '==', auth.currentUser.uid),
                    where('courseId', '==', courseId)
                );
                const progressSnapshot = await getDocs(progressQuery);
                
                let progress = 0;
                let lastLessonIndex = 0;
                if (!progressSnapshot.empty) {
                    const progressData = progressSnapshot.docs[0].data();
                    const completedCount = progressData.completedLessons?.length || 0;
                    const totalLessons = course.lessons?.length || 1;
                    progress = Math.round((completedCount / totalLessons) * 100);
                    lastLessonIndex = progressData.lastAccessedLesson || 0;
                }

                const courseCard = createEnrolledCourseCard(courseId, course, progress, lastLessonIndex);
                grid.appendChild(courseCard);
            }
        }
    } catch (error) {
        console.error('Error loading enrolled courses:', error);
        grid.innerHTML = '<p class="loading">Error loading your courses.</p>';
    }
}

function createEnrolledCourseCard(id, course, progress, lastLessonIndex) {
    const card = document.createElement('div');
    card.className = 'course-card';

    card.innerHTML = `
        <img src="${course.thumbnail || 'https://via.placeholder.com/400x200'}" alt="${course.title}">
        <div class="course-card-content">
            <span class="course-category">${course.category}</span>
            <h3>${course.title}</h3>
            <p>${course.description.substring(0, 100)}...</p>
            <div style="margin-top: 1rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span style="font-size: 0.875rem; color: var(--text-secondary);">Progress</span>
                    <span style="font-size: 0.875rem; font-weight: 600;">${progress}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progress}%;"></div>
                </div>
            </div>
            <a href="lesson.html?courseId=${id}&lessonIndex=${lastLessonIndex}" class="btn btn-primary btn-full" style="margin-top: 1rem;">
                ${progress > 0 ? 'Continue Learning' : 'Start Course'}
            </a>
        </div>
    `;

    return card;
}

// Load user profile
async function loadUserProfile() {
    const userEmail = document.getElementById('userEmail');
    const userRole = document.getElementById('userRole');

    if (auth.currentUser) {
        userEmail.textContent = auth.currentUser.email;

        try {
            const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
            if (userDoc.exists()) {
                const role = userDoc.data().role || 'student';
                userRole.textContent = role.charAt(0).toUpperCase() + role.slice(1);
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
        }
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', initDashboard);
