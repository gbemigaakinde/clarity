import { auth, db } from './firebase-config.js';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, addDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { requireAuth } from './auth.js';

let courseId = null;
let courseData = null;
let progressData = null;
let currentModuleId = null;
let currentLessonId = null;

// Get course ID from URL
function getCourseIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('courseId');
}

// Initialize lesson viewer
async function initLessonViewer() {
    await requireAuth();
    
    courseId = getCourseIdFromUrl();
    if (!courseId) {
        window.location.href = 'courses.html';
        return;
    }

    await loadCourseData();
    await loadProgressData();
    determineCurrentLesson();
    renderLessonViewer();
}

// Load course data
async function loadCourseData() {
    try {
        const courseDoc = await getDoc(doc(db, 'courses', courseId));
        if (!courseDoc.exists()) {
            alert('Course not found');
            window.location.href = 'courses.html';
            return;
        }
        courseData = { id: courseDoc.id, ...courseDoc.data() };
    } catch (error) {
        console.error('Error loading course:', error);
        alert('Error loading course');
    }
}

// Load progress data
async function loadProgressData() {
    try {
        const progressRef = collection(db, 'progress');
        const q = query(
            progressRef,
            where('userId', '==', auth.currentUser.uid),
            where('courseId', '==', courseId)
        );
        const progressSnapshot = await getDocs(q);
        
        if (!progressSnapshot.empty) {
            progressData = { id: progressSnapshot.docs[0].id, ...progressSnapshot.docs[0].data() };
        } else {
            // Create initial progress if doesn't exist
            const firstModule = courseData.modules?.sort((a, b) => a.order - b.order)[0];
            const firstLesson = firstModule?.lessons?.sort((a, b) => a.order - b.order)[0];
            
            const newProgress = {
                userId: auth.currentUser.uid,
                courseId: courseId,
                completedModules: [],
                completedLessons: {},
                currentModule: firstModule?.id || null,
                currentLesson: firstLesson?.id || null,
                lastAccessedAt: new Date(),
                accessHistory: [],
                updatedAt: new Date()
            };
            
            const docRef = await addDoc(collection(db, 'progress'), newProgress);
            progressData = { id: docRef.id, ...newProgress };
        }
    } catch (error) {
        console.error('Error loading progress:', error);
    }
}

// Determine current lesson to show
function determineCurrentLesson() {
    if (progressData.currentModule && progressData.currentLesson) {
        currentModuleId = progressData.currentModule;
        currentLessonId = progressData.currentLesson;
    } else {
        // Default to first module and lesson
        const firstModule = courseData.modules?.sort((a, b) => a.order - b.order)[0];
        const firstLesson = firstModule?.lessons?.sort((a, b) => a.order - b.order)[0];
        currentModuleId = firstModule?.id;
        currentLessonId = firstLesson?.id;
    }
}

// Check if lesson is accessible
function isLessonAccessible(moduleId, lessonId) {
    const module = courseData.modules.find(m => m.id === moduleId);
    if (!module) return false;
    
    const lesson = module.lessons.find(l => l.id === lessonId);
    if (!lesson) return false;

    const accessRule = lesson.accessRule || courseData.accessConfig?.type || 'sequential';
    
    // Anytime access
    if (accessRule === 'anytime' || courseData.accessConfig?.allowSkip) {
        return true;
    }

    // Sequential access - check if previous lesson is completed
    if (accessRule === 'sequential') {
        const lessonOrder = lesson.order;
        
        // First lesson is always accessible
        if (lessonOrder === 1) {
            // Check if it's the first lesson in the first module
            const moduleOrder = module.order;
            if (moduleOrder === 1) return true;
            
            // Check if previous module is completed
            const previousModule = courseData.modules.find(m => m.order === moduleOrder - 1);
            if (previousModule) {
                return progressData.completedModules?.includes(previousModule.id);
            }
        }
        
        // Check if previous lesson in same module is completed
        const previousLesson = module.lessons.find(l => l.order === lessonOrder - 1);
        if (previousLesson) {
            const moduleCompletedLessons = progressData.completedLessons?.[moduleId] || [];
            return moduleCompletedLessons.includes(previousLesson.id);
        }
    }

    // Time-based access (daily, weekly, monthly)
    if (['daily', 'weekly', 'monthly'].includes(accessRule)) {
        const lastAccess = progressData.accessHistory?.find(h => h.lessonId === lessonId);
        if (!lastAccess) return true; // First time access
        
        const lastAccessDate = lastAccess.accessedAt.toDate();
        const now = new Date();
        const diffMs = now - lastAccessDate;
        const diffHours = diffMs / (1000 * 60 * 60);
        
        if (accessRule === 'daily' && diffHours >= 24) return true;
        if (accessRule === 'weekly' && diffHours >= 168) return true;
        if (accessRule === 'monthly' && diffHours >= 720) return true;
        
        return false;
    }

    return true;
}

// Render lesson viewer
function renderLessonViewer() {
    const module = courseData.modules.find(m => m.id === currentModuleId);
    const lesson = module?.lessons.find(l => l.id === currentLessonId);
    
    if (!module || !lesson) {
        document.body.innerHTML = '<div class="container"><p>Lesson not found</p></div>';
        return;
    }

    // Check accessibility
    const accessible = isLessonAccessible(currentModuleId, currentLessonId);
    
    document.body.innerHTML = `
        <nav class="navbar">
            <div class="container nav-container">
                <a href="index.html" class="logo">Clarity Academy</a>
                <ul class="nav-links">
                    <li><a href="courses.html">Courses</a></li>
                    <li><a href="dashboard.html">Dashboard</a></li>
                    <li><a href="#" id="logoutLink">Logout</a></li>
                </ul>
            </div>
        </nav>

        <div class="lesson-container">
            <div class="lesson-sidebar">
                <div class="lesson-sidebar-header">
                    <h3>${courseData.title}</h3>
                    <a href="course-detail.html?id=${courseId}" class="btn btn-sm btn-secondary">
                        <i class="fas fa-arrow-left"></i> Back to Course
                    </a>
                </div>
                <div class="lesson-sidebar-content" id="lessonSidebarContent"></div>
            </div>

            <div class="lesson-main">
                ${accessible ? renderLessonContent(module, lesson) : renderLockedContent(lesson)}
            </div>
        </div>
    `;

    renderSidebar();
    
    // Re-attach auth listener
    const logoutLink = document.getElementById('logoutLink');
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            auth.signOut().then(() => {
                window.location.href = 'index.html';
            });
        });
    }

    // Update access history
    if (accessible) {
        updateAccessHistory(currentLessonId);
    }
}

// Render lesson content
function renderLessonContent(module, lesson) {
    const isCompleted = (progressData.completedLessons?.[currentModuleId] || []).includes(currentLessonId);
    
    let contentHTML = '';
    
    if (lesson.type === 'video' || lesson.type === 'mixed') {
        const videoUrl = convertToEmbedUrl(lesson.videoUrl);
        contentHTML += `
            <div class="lesson-video">
                <iframe src="${videoUrl}" frameborder="0" allowfullscreen></iframe>
            </div>
        `;
    }
    
    if (lesson.type === 'text' || lesson.type === 'mixed') {
        contentHTML += `
            <div class="lesson-text-content">
                ${lesson.content}
            </div>
        `;
    }

    const { nextModule, nextLesson } = getNextLesson();
    const hasNext = nextModule && nextLesson;

    return `
        <div class="lesson-header">
            <div>
                <h4 style="color: var(--text-secondary); margin: 0;">Module ${module.order}: ${module.title}</h4>
                <h1 style="margin: 0.5rem 0;">${lesson.title}</h1>
            </div>
            ${lesson.duration ? `<span style="color: var(--text-secondary);"><i class="fas fa-clock"></i> ${lesson.duration} minutes</span>` : ''}
        </div>

        ${contentHTML}

        <div class="lesson-footer">
            <button class="btn ${isCompleted ? 'btn-secondary' : 'btn-primary'}" id="completeBtn">
                <i class="fas ${isCompleted ? 'fa-check-circle' : 'fa-circle'}"></i>
                ${isCompleted ? 'Completed' : 'Mark as Complete'}
            </button>
            ${hasNext ? `<button class="btn btn-primary" id="nextBtn">
                Next Lesson <i class="fas fa-arrow-right"></i>
            </button>` : ''}
        </div>
    `;
}

// Render locked content
function renderLockedContent(lesson) {
    return `
        <div class="lesson-locked">
            <i class="fas fa-lock" style="font-size: 4rem; color: var(--text-secondary); margin-bottom: 1rem;"></i>
            <h2>Lesson Locked</h2>
            <p>Complete the previous lessons to unlock this content.</p>
            <p style="margin-top: 1rem; color: var(--text-secondary);">Access Rule: ${lesson.accessRule || 'sequential'}</p>
        </div>
    `;
}

// Render sidebar
function renderSidebar() {
    const sidebarContent = document.getElementById('lessonSidebarContent');
    if (!sidebarContent) return;

    const sortedModules = courseData.modules?.sort((a, b) => a.order - b.order) || [];
    
    let html = '';
    sortedModules.forEach(module => {
        const moduleCompleted = progressData.completedModules?.includes(module.id);
        const sortedLessons = module.lessons?.sort((a, b) => a.order - b.order) || [];
        
        const lessonsHTML = sortedLessons.map(lesson => {
            const isCurrentLesson = currentModuleId === module.id && currentLessonId === lesson.id;
            const isCompleted = (progressData.completedLessons?.[module.id] || []).includes(lesson.id);
            const accessible = isLessonAccessible(module.id, lesson.id);
            
            return `
                <div class="sidebar-lesson ${isCurrentLesson ? 'active' : ''} ${!accessible ? 'locked' : ''}" 
                     onclick="${accessible ? `window.lessonViewer.navigateToLesson('${module.id}', '${lesson.id}')` : ''}">
                    <div>
                        <span style="font-size: 0.875rem;">${lesson.order}. ${lesson.title}</span>
                        ${lesson.duration ? `<span style="font-size: 0.75rem; color: var(--text-secondary); display: block;">${lesson.duration} min</span>` : ''}
                    </div>
                    <i class="fas ${isCompleted ? 'fa-check-circle' : (accessible ? 'fa-circle' : 'fa-lock')}" 
                       style="color: ${isCompleted ? 'var(--success-color)' : 'var(--text-secondary)'};"></i>
                </div>
            `;
        }).join('');
        
        html += `
            <div class="sidebar-module">
                <div class="sidebar-module-header">
                    <h4>
                        <i class="fas fa-layer-group"></i>
                        Module ${module.order}: ${module.title}
                    </h4>
                    ${moduleCompleted ? '<i class="fas fa-check-circle" style="color: var(--success-color);"></i>' : ''}
                </div>
                ${lessonsHTML}
            </div>
        `;
    });
    
    sidebarContent.innerHTML = html;
}

// Navigate to lesson
function navigateToLesson(moduleId, lessonId) {
    currentModuleId = moduleId;
    currentLessonId = lessonId;
    renderLessonViewer();
}

// Get next lesson
function getNextLesson() {
    const currentModule = courseData.modules.find(m => m.id === currentModuleId);
    if (!currentModule) return { nextModule: null, nextLesson: null };

    const currentLesson = currentModule.lessons.find(l => l.id === currentLessonId);
    if (!currentLesson) return { nextModule: null, nextLesson: null };

    // Try next lesson in same module
    const nextLessonInModule = currentModule.lessons.find(l => l.order === currentLesson.order + 1);
    if (nextLessonInModule) {
        return { nextModule: currentModule, nextLesson: nextLessonInModule };
    }

    // Try first lesson in next module
    const nextModule = courseData.modules.find(m => m.order === currentModule.order + 1);
    if (nextModule && nextModule.lessons?.length > 0) {
        const firstLesson = nextModule.lessons.sort((a, b) => a.order - b.order)[0];
        return { nextModule, nextLesson: firstLesson };
    }

    return { nextModule: null, nextLesson: null };
}

// Mark lesson as complete
async function markLessonComplete() {
    try {
        const completedLessons = progressData.completedLessons || {};
        const moduleCompletedLessons = completedLessons[currentModuleId] || [];
        
        if (!moduleCompletedLessons.includes(currentLessonId)) {
            moduleCompletedLessons.push(currentLessonId);
            completedLessons[currentModuleId] = moduleCompletedLessons;
        }

        // Check if module is completed
        const currentModule = courseData.modules.find(m => m.id === currentModuleId);
        const allLessonsCompleted = currentModule.lessons.every(l => 
            moduleCompletedLessons.includes(l.id)
        );

        const completedModules = progressData.completedModules || [];
        if (allLessonsCompleted && !completedModules.includes(currentModuleId)) {
            completedModules.push(currentModuleId);
            
            // Show module completion alert
            alert(`🎉 Congratulations! You've completed Module ${currentModule.order}: ${currentModule.title}`);
        }

        // Get next lesson
        const { nextModule, nextLesson } = getNextLesson();

        // Update progress
        await updateDoc(doc(db, 'progress', progressData.id), {
            completedLessons: completedLessons,
            completedModules: completedModules,
            currentModule: nextModule?.id || currentModuleId,
            currentLesson: nextLesson?.id || currentLessonId,
            updatedAt: new Date()
        });

        progressData.completedLessons = completedLessons;
        progressData.completedModules = completedModules;

        // Check if course is completed
        const allModulesCompleted = courseData.modules.every(m => completedModules.includes(m.id));
        if (allModulesCompleted) {
            alert(`🏆 Amazing! You've completed the entire course: ${courseData.title}!`);
        } else if (nextLesson) {
            // Move to next lesson
            const moveToNext = confirm(`Lesson completed! Move to next lesson: ${nextLesson.title}?`);
            if (moveToNext) {
                currentModuleId = nextModule.id;
                currentLessonId = nextLesson.id;
            }
        }

        renderLessonViewer();
    } catch (error) {
        console.error('Error marking lesson complete:', error);
        alert('Error updating progress');
    }
}

// Update access history
async function updateAccessHistory(lessonId) {
    try {
        const accessHistory = progressData.accessHistory || [];
        const existingIndex = accessHistory.findIndex(h => h.lessonId === lessonId);
        
        if (existingIndex !== -1) {
            accessHistory[existingIndex].accessedAt = new Date();
        } else {
            accessHistory.push({
                lessonId: lessonId,
                accessedAt: new Date()
            });
        }

        await updateDoc(doc(db, 'progress', progressData.id), {
            accessHistory: accessHistory,
            lastAccessedAt: new Date()
        });

        progressData.accessHistory = accessHistory;
    } catch (error) {
        console.error('Error updating access history:', error);
    }
}

// Convert video URL to embed URL
function convertToEmbedUrl(url) {
    if (url.includes('youtube.com/watch')) {
        const videoId = new URL(url).searchParams.get('v');
        return `https://www.youtube.com/embed/${videoId}`;
    }
    if (url.includes('youtu.be/')) {
        const videoId = url.split('youtu.be/')[1];
        return `https://www.youtube.com/embed/${videoId}`;
    }
    if (url.includes('vimeo.com/')) {
        const videoId = url.split('vimeo.com/')[1];
        return `https://player.vimeo.com/video/${videoId}`;
    }
    return url;
}

// Attach event listeners after render
document.addEventListener('click', (e) => {
    if (e.target.id === 'completeBtn') {
        markLessonComplete();
    }
    if (e.target.id === 'nextBtn') {
        const { nextModule, nextLesson } = getNextLesson();
        if (nextModule && nextLesson) {
            currentModuleId = nextModule.id;
            currentLessonId = nextLesson.id;
            renderLessonViewer();
        }
    }
});

// Export functions
window.lessonViewer = {
    navigateToLesson
};

// Initialize
document.addEventListener('DOMContentLoaded', initLessonViewer);