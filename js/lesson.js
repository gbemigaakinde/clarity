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
        console.error('No courseId in URL');
        window.location.href = 'courses.html';
        return;
    }

    console.log('Loading course:', courseId);
    
    try {
        await loadCourseData();
        await loadProgressData();
        await determineCurrentLesson();
        renderLessonViewer();
        setupMobileSidebar();
        setupEventListeners(); // NEW: Consolidated event listener setup
    } catch (error) {
        console.error('Error initializing lesson viewer:', error);
        showError('Failed to load lesson. Please try again.');
    }
}

// Show error message
function showError(message) {
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
        <div class="container" style="padding: 3rem 0; text-align: center;">
            <i class="fas fa-exclamation-circle" style="font-size: 4rem; color: var(--error); margin-bottom: 1rem;"></i>
            <h2>Error Loading Lesson</h2>
            <p style="color: var(--text-secondary); margin-bottom: 2rem;">${message}</p>
            <a href="courses.html" class="btn btn-primary">Back to Courses</a>
        </div>
    `;
}

// Load course data
async function loadCourseData() {
    try {
        const courseDoc = await getDoc(doc(db, 'courses', courseId));
        if (!courseDoc.exists()) {
            throw new Error('Course not found');
        }
        
        courseData = { id: courseDoc.id, ...courseDoc.data() };
        
        // Validate course has modules and lessons
        if (!courseData.modules || courseData.modules.length === 0) {
            throw new Error('This course has no modules yet');
        }
        
        console.log('Course data loaded:', courseData);
    } catch (error) {
        console.error('Error loading course:', error);
        throw error;
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
            console.log('Progress data loaded:', progressData);
        } else {
            console.log('No progress found, creating new progress record');
            // Create initial progress if doesn't exist
            await createInitialProgress();
        }
    } catch (error) {
        console.error('Error loading progress:', error);
        throw error;
    }
}

// Create initial progress record
async function createInitialProgress() {
    const sortedModules = courseData.modules.sort((a, b) => a.order - b.order);
    const firstModule = sortedModules[0];
    
    if (!firstModule) {
        throw new Error('No modules found in course');
    }
    
    const sortedLessons = (firstModule.lessons || []).sort((a, b) => a.order - b.order);
    const firstLesson = sortedLessons[0];
    
    if (!firstLesson) {
        throw new Error('No lessons found in first module');
    }
    
    const newProgress = {
        userId: auth.currentUser.uid,
        courseId: courseId,
        completedModules: [],
        completedLessons: {},
        currentModule: firstModule.id,
        currentLesson: firstLesson.id,
        lastAccessedAt: new Date(),
        accessHistory: [],
        updatedAt: new Date()
    };
    
    const docRef = await addDoc(collection(db, 'progress'), newProgress);
    progressData = { id: docRef.id, ...newProgress };
    console.log('Initial progress created:', progressData);
}

// Determine current lesson to show
async function determineCurrentLesson() {
    try {
        // First, try to use progress data
        if (progressData && progressData.currentModule && progressData.currentLesson) {
            const module = courseData.modules.find(m => m.id === progressData.currentModule);
            const lesson = module?.lessons?.find(l => l.id === progressData.currentLesson);
            
            if (module && lesson) {
                currentModuleId = progressData.currentModule;
                currentLessonId = progressData.currentLesson;
                console.log('Using progress data - Module:', currentModuleId, 'Lesson:', currentLessonId);
                return;
            }
        }
        
        // Fallback: Use first available lesson
        const sortedModules = courseData.modules.sort((a, b) => a.order - b.order);
        const firstModule = sortedModules[0];
        
        if (!firstModule) {
            throw new Error('No modules available');
        }
        
        const sortedLessons = (firstModule.lessons || []).sort((a, b) => a.order - b.order);
        const firstLesson = sortedLessons[0];
        
        if (!firstLesson) {
            throw new Error('No lessons available in first module');
        }
        
        currentModuleId = firstModule.id;
        currentLessonId = firstLesson.id;
        
        // Update progress to reflect this
        await updateDoc(doc(db, 'progress', progressData.id), {
            currentModule: currentModuleId,
            currentLesson: currentLessonId,
            updatedAt: new Date()
        });
        
        console.log('Using first lesson - Module:', currentModuleId, 'Lesson:', currentLessonId);
    } catch (error) {
        console.error('Error determining current lesson:', error);
        throw error;
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

// Setup mobile sidebar toggle - FIXED VERSION
function setupMobileSidebar() {
    // Remove any existing elements first
    const existingToggle = document.querySelector('.mobile-sidebar-toggle');
    const existingOverlay = document.querySelector('.mobile-sidebar-overlay');
    if (existingToggle) existingToggle.remove();
    if (existingOverlay) existingOverlay.remove();

    // Create toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'mobile-sidebar-toggle';
    toggleBtn.innerHTML = '<i class="fas fa-list"></i>';
    toggleBtn.setAttribute('aria-label', 'Toggle lesson list');
    document.body.appendChild(toggleBtn);

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'mobile-sidebar-overlay';
    document.body.appendChild(overlay);

    const sidebar = document.querySelector('.lesson-sidebar');

    // Toggle sidebar function
    const toggleSidebar = (show) => {
        if (show) {
            sidebar.classList.add('mobile-open');
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        } else {
            sidebar.classList.remove('mobile-open');
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    };

    // Toggle button click - FIXED: No stopPropagation
    toggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const isOpen = sidebar.classList.contains('mobile-open');
        toggleSidebar(!isOpen);
    });

    // Overlay click to close - FIXED: No stopPropagation
    overlay.addEventListener('click', (e) => {
        e.preventDefault();
        toggleSidebar(false);
    });

    // Close sidebar when lesson is clicked on mobile
    sidebar.addEventListener('click', (e) => {
        const lessonElement = e.target.closest('.sidebar-lesson');
        if (lessonElement && !lessonElement.classList.contains('locked')) {
            if (window.innerWidth <= 768) {
                setTimeout(() => {
                    toggleSidebar(false);
                }, 100);
            }
        }
    });

    // Handle window resize
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (window.innerWidth > 768) {
                sidebar.classList.remove('mobile-open');
                overlay.classList.remove('active');
                document.body.style.overflow = '';
            }
        }, 250);
    });
}

// Render lesson viewer
function renderLessonViewer() {
    const module = courseData.modules.find(m => m.id === currentModuleId);
    const lesson = module?.lessons.find(l => l.id === currentLessonId);
    
    if (!module || !lesson) {
        showError('Lesson not found. The course structure may have changed.');
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
    setupMobileSidebar();
    setupEventListeners(); // Re-setup event listeners after render
    
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

// Render sidebar - FIXED VERSION
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
            
            let cssClasses = 'sidebar-lesson';
            if (isCurrentLesson) cssClasses += ' active';
            if (isCompleted) cssClasses += ' completed';
            if (!accessible) cssClasses += ' locked';
            
            return `
                <div class="${cssClasses}" 
                     data-module-id="${module.id}"
                     data-lesson-id="${lesson.id}"
                     data-accessible="${accessible}">
                    <div class="lesson-title-wrapper">
                        <span style="font-size: 0.875rem;">${lesson.order}. ${lesson.title}</span>
                        ${lesson.duration ? `<span style="font-size: 0.75rem; color: var(--text-secondary); display: block;">${lesson.duration} min</span>` : ''}
                    </div>
                    <i class="fas ${isCompleted ? 'fa-check-circle' : (accessible ? 'fa-circle' : 'fa-lock')}" 
                       style="color: ${isCompleted ? 'var(--success)' : 'var(--text-secondary)'};"></i>
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
                    ${moduleCompleted ? '<i class="fas fa-check-circle" style="color: var(--success);"></i>' : ''}
                </div>
                ${lessonsHTML}
            </div>
        `;
    });
    
    sidebarContent.innerHTML = html;
    
    // Attach click handlers using event delegation - FIXED
    const lessons = sidebarContent.querySelectorAll('.sidebar-lesson');
    lessons.forEach(lessonElement => {
        lessonElement.addEventListener('click', (e) => {
            const accessible = lessonElement.getAttribute('data-accessible') === 'true';
            if (!accessible) return;
            
            const moduleId = lessonElement.getAttribute('data-module-id');
            const lessonId = lessonElement.getAttribute('data-lesson-id');
            
            if (moduleId && lessonId) {
                navigateToLesson(moduleId, lessonId);
            }
        });
    });
}

// Navigate to lesson
function navigateToLesson(moduleId, lessonId) {
    currentModuleId = moduleId;
    currentLessonId = lessonId;
    renderLessonViewer();
    
    // Scroll to top of lesson content on mobile
    if (window.innerWidth <= 768) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
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
        const videoId = url.split('youtu.be/')[1].split('?')[0];
        return `https://www.youtube.com/embed/${videoId}`;
    }
    if (url.includes('vimeo.com/')) {
        const videoId = url.split('vimeo.com/')[1].split('?')[0];
        return `https://player.vimeo.com/video/${videoId}`;
    }
    return url;
}

// NEW: Consolidated event listener setup
function setupEventListeners() {
    // Logout link
    const logoutLink = document.getElementById('logoutLink');
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            auth.signOut().then(() => {
                window.location.href = 'index.html';
            });
        });
    }

    // Complete button
    const completeBtn = document.getElementById('completeBtn');
    if (completeBtn) {
        completeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            markLessonComplete();
        });
    }

    // Next button
    const nextBtn = document.getElementById('nextBtn');
    if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const { nextModule, nextLesson } = getNextLesson();
            if (nextModule && nextLesson) {
                currentModuleId = nextModule.id;
                currentLessonId = nextLesson.id;
                renderLessonViewer();
            }
        });
    }
}

// Export functions
window.lessonViewer = {
    navigateToLesson
};

// Initialize
document.addEventListener('DOMContentLoaded', initLessonViewer);