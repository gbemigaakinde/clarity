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

        const courseIds = [];
        const enrollmentMap = {};
        enrollmentsSnapshot.forEach((doc) => {
            const enrollment = doc.data();
            courseIds.push(enrollment.courseId);
            enrollmentMap[enrollment.courseId] = enrollment;
        });

        grid.innerHTML = '';
        for (const courseId of courseIds) {
            try {
                const courseDoc = await getDoc(doc(db, 'courses', courseId));
                if (courseDoc.exists()) {
                    const course = { id: courseDoc.id, ...courseDoc.data() };
                    const enrollment = enrollmentMap[courseId];
                    
                    const progressRef = collection(db, 'progress');
                    const progressQuery = query(
                        progressRef,
                        where('userId', '==', auth.currentUser.uid),
                        where('courseId', '==', courseId)
                    );
                    const progressSnapshot = await getDocs(progressQuery);
                    
                    let progress = 0;
                    let lastModuleId = null;
                    let lastLessonId = null;
                    
                    if (!progressSnapshot.empty) {
                        const progressData = progressSnapshot.docs[0].data();
                        
                        // Calculate progress based on completed lessons
                        const totalLessons = course.modules?.reduce((sum, mod) => 
                            sum + (mod.lessons?.length || 0), 0) || 1;
                        
                        const completedLessonsCount = Object.values(progressData.completedLessons || {})
                            .reduce((sum, arr) => sum + arr.length, 0);
                        
                        progress = Math.round((completedLessonsCount / totalLessons) * 100);
                        lastModuleId = progressData.currentModule;
                        lastLessonId = progressData.currentLesson;
                    }

                    const courseCard = createEnrolledCourseCard(course, progress, lastModuleId, lastLessonId);
                    grid.appendChild(courseCard);
                }
            } catch (error) {
                console.error('Error loading course:', courseId, error);
            }
        }
    } catch (error) {
        console.error('Error loading enrolled courses:', error);
        grid.innerHTML = '<p class="loading">Error loading your courses.</p>';
    }
}

function createEnrolledCourseCard(course, progress, lastModuleId, lastLessonId) {
    const card = document.createElement('div');
    card.className = 'course-card';

    const moduleCount = course.modules ? course.modules.length : 0;

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
            <div style="margin-top: 0.75rem; font-size: 0.875rem; color: var(--text-secondary);">
                <i class="fas fa-layer-group"></i> ${moduleCount} modules
            </div>
            <a href="lesson.html?courseId=${course.id}" class="btn btn-primary btn-full" style="margin-top: 1rem;">
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