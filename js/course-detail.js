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
    
    // Calculate totals from modules
    const moduleCount = courseData.modules ? courseData.modules.length : 0;
    const lessonCount = courseData.modules 
        ? courseData.modules.reduce((sum, mod) => sum + (mod.lessons?.length || 0), 0)
        : 0;
    const totalDuration = courseData.modules 
        ? courseData.modules.reduce((sum, mod) => {
            const modDuration = mod.lessons?.reduce((s, l) => s + (l.duration || 0), 0) || 0;
            return sum + modDuration;
        }, 0)
        : 0;

    const enrollButton = isEnrolled 
        ? '<a href="lesson.html?courseId=' + courseId + '" class="btn btn-primary btn-full">Continue Learning</a>'
        : '<button id="enrollBtn" class="btn btn-primary btn-full">Enroll Now - $' + courseData.price + '</button>';

    // Build curriculum HTML from modules
    const curriculumHTML = courseData.modules && courseData.modules.length > 0
        ? courseData.modules.sort((a, b) => a.order - b.order).map((module, modIndex) => {
            const moduleLessons = module.lessons || [];
            const lessonsHTML = moduleLessons.sort((a, b) => a.order - b.order).map((lesson, lessonIndex) => {
                let typeIcon = 'fa-video';
                if (lesson.type === 'text') {
                    typeIcon = 'fa-file-alt';
                } else if (lesson.type === 'mixed') {
                    typeIcon = 'fa-layer-group';
                }
                
                const durationText = lesson.duration ? `${lesson.duration} min` : '';
                
                return `
                    <li class="curriculum-item" style="margin-left: 2rem;">
                        <div class="lesson-info">
                            <h5 style="font-weight: 500; font-size: 0.95rem;">
                                <i class="fas ${typeIcon}"></i> ${lesson.order}. ${lesson.title}
                            </h5>
                            ${durationText ? `<span style="font-size: 0.875rem;">${durationText}</span>` : ''}
                        </div>
                        ${isEnrolled ? '<i class="fas fa-play-circle"></i>' : '<i class="fas fa-lock"></i>'}
                    </li>
                `;
            }).join('');
            
            return `
                <li class="curriculum-item" style="background: #f8f9fa; margin-bottom: 0.5rem;">
                    <div class="lesson-info">
                        <h4><i class="fas fa-layer-group"></i> Module ${module.order}: ${module.title}</h4>
                        ${module.description ? `<p style="margin: 0.25rem 0 0 0; color: var(--text-secondary); font-size: 0.875rem;">${module.description}</p>` : ''}
                    </div>
                    <span style="font-size: 0.875rem; color: var(--text-secondary);">${moduleLessons.length} lessons</span>
                </li>
                ${lessonsHTML}
            `;
        }).join('')
        : '<li class="curriculum-item"><p>No modules or lessons available yet.</p></li>';

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
                        <i class="fas fa-layer-group"></i>
                        ${moduleCount} Modules
                    </span>
                    <span>
                        <i class="fas fa-play-circle"></i>
                        ${lessonCount} Lessons
                    </span>
                    ${totalDuration > 0 ? `<span>
                        <i class="fas fa-clock"></i>
                        ${totalDuration} Minutes
                    </span>` : ''}
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
                                    <i class="fas fa-layer-group"></i>
                                    ${moduleCount} modules
                                </li>
                                <li style="margin-bottom: 0.5rem;">
                                    <i class="fas fa-book-open"></i>
                                    ${lessonCount} lessons
                                </li>
                                ${totalDuration > 0 ? `<li style="margin-bottom: 0.5rem;">
                                    <i class="fas fa-clock"></i>
                                    ${totalDuration} minutes of content
                                </li>` : ''}
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
        await addDoc(collection(db, 'enrollments'), {
            userId: auth.currentUser.uid,
            courseId: courseId,
            enrolledAt: new Date(),
            progress: 0,
            completedLessons: []
        });

        // Get first module and lesson
        const firstModule = courseData.modules?.sort((a, b) => a.order - b.order)[0];
        const firstLesson = firstModule?.lessons?.sort((a, b) => a.order - b.order)[0];

        await addDoc(collection(db, 'progress'), {
            userId: auth.currentUser.uid,
            courseId: courseId,
            completedModules: [],
            completedLessons: {},
            currentModule: firstModule?.id || null,
            currentLesson: firstLesson?.id || null,
            lastAccessedAt: new Date(),
            accessHistory: [],
            updatedAt: new Date()
        });

        alert('Successfully enrolled! Redirecting to course...');
        window.location.href = `lesson.html?courseId=${courseId}`;
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
