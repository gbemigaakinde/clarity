import { auth, db } from './firebase-config.js';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, arrayUnion } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { requireAuth } from './auth.js';

let courseId = null;
let courseData = null;
let currentLessonIndex = 0;
let progressDocId = null;
let completedLessons = [];

// Get parameters from URL
function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        courseId: params.get('courseId'),
        lessonIndex: parseInt(params.get('lessonIndex')) || 0
    };
}

// Initialize lesson view
async function initLessonView() {
    await requireAuth();

    const params = getUrlParams();
    courseId = params.courseId;
    currentLessonIndex = params.lessonIndex;

    if (!courseId) {
        window.location.href = 'dashboard.html';
        return;
    }

    await loadCourse();
    await loadProgress();
    displayLessonsList();
    displayCurrentLesson();
}

// Load course data
async function loadCourse() {
    try {
        const courseDoc = await getDoc(doc(db, 'courses', courseId));
        if (!courseDoc.exists()) {
            alert('Course not found');
            window.location.href = 'dashboard.html';
            return;
        }

        courseData = courseDoc.data();
        document.getElementById('courseTitle').textContent = courseData.title;
    } catch (error) {
        console.error('Error loading course:', error);
        alert('Error loading course');
    }
}

// Load user progress
async function loadProgress() {
    try {
        const progressRef = collection(db, 'progress');
        const q = query(
            progressRef,
            where('userId', '==', auth.currentUser.uid),
            where('courseId', '==', courseId)
        );
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            progressDocId = querySnapshot.docs[0].id;
            const progressData = querySnapshot.docs[0].data();
            completedLessons = progressData.completedLessons || [];
        }
    } catch (error) {
        console.error('Error loading progress:', error);
    }
}

// Display lessons list
function displayLessonsList() {
    const lessonsList = document.getElementById('lessonsList');
    
    if (!courseData.lessons || courseData.lessons.length === 0) {
        lessonsList.innerHTML = '<p class="loading">No lessons available.</p>';
        return;
    }

    lessonsList.innerHTML = '';
    courseData.lessons.forEach((lesson, index) => {
        const lessonItem = document.createElement('div');
        lessonItem.className = 'lesson-item';
        
        if (index === currentLessonIndex) {
            lessonItem.classList.add('active');
        }
        
        if (completedLessons.includes(index)) {
            lessonItem.classList.add('completed');
        }

        lessonItem.innerHTML = `
            <div class="lesson-item-header">
                <h4>${index + 1}. ${lesson.title}</h4>
                ${completedLessons.includes(index) ? '<i class="fas fa-check-circle"></i>' : ''}
            </div>
            <div class="lesson-item-meta">
                <span><i class="fas fa-clock"></i> ${lesson.duration} min</span>
            </div>
        `;

        lessonItem.onclick = () => {
            currentLessonIndex = index;
            updateUrl();
            displayLessonsList();
            displayCurrentLesson();
        };

        lessonsList.appendChild(lessonItem);
    });
}

// Display current lesson
function displayCurrentLesson() {
    const lessonContent = document.getElementById('lessonContent');
    
    if (!courseData.lessons || currentLessonIndex >= courseData.lessons.length) {
        lessonContent.innerHTML = '<p class="loading">Lesson not found.</p>';
        return;
    }

    const lesson = courseData.lessons[currentLessonIndex];
    const isCompleted = completedLessons.includes(currentLessonIndex);
    const hasNext = currentLessonIndex < courseData.lessons.length - 1;
    const hasPrev = currentLessonIndex > 0;

    // Extract video ID from URL if it's a YouTube link
    let videoEmbed = lesson.videoUrl;
    if (lesson.videoUrl.includes('youtube.com') || lesson.videoUrl.includes('youtu.be')) {
        const videoId = extractYouTubeId(lesson.videoUrl);
        if (videoId) {
            videoEmbed = `https://www.youtube.com/embed/${videoId}`;
        }
    }

    lessonContent.innerHTML = `
        <h1>${lesson.title}</h1>
        <div class="video-container">
            ${videoEmbed.includes('youtube.com/embed') 
                ? `<iframe src="${videoEmbed}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
                : `<video controls src="${videoEmbed}"></video>`
            }
        </div>
        
        <div class="lesson-actions">
            ${hasPrev ? `<button class="btn btn-secondary" onclick="window.lessonView.prevLesson()">
                <i class="fas fa-arrow-left"></i> Previous
            </button>` : '<div></div>'}
            
            <button class="btn ${isCompleted ? 'btn-secondary' : 'btn-primary'}" onclick="window.lessonView.toggleComplete()">
                ${isCompleted ? '<i class="fas fa-check-circle"></i> Completed' : '<i class="far fa-circle"></i> Mark as Complete'}
            </button>
            
            ${hasNext ? `<button class="btn btn-primary" onclick="window.lessonView.nextLesson()">
                Next <i class="fas fa-arrow-right"></i>
            </button>` : '<div></div>'}
        </div>
    `;

    // Update progress
    updateLastAccessedLesson();
}

function extractYouTubeId(url) {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : null;
}

// Update URL without reload
function updateUrl() {
    const newUrl = `lesson.html?courseId=${courseId}&lessonIndex=${currentLessonIndex}`;
    window.history.pushState({}, '', newUrl);
}

// Toggle lesson completion
async function toggleComplete() {
    if (!progressDocId) return;

    try {
        const isCompleted = completedLessons.includes(currentLessonIndex);

        if (isCompleted) {
            // Remove from completed
            completedLessons = completedLessons.filter(i => i !== currentLessonIndex);
        } else {
            // Add to completed
            completedLessons.push(currentLessonIndex);
        }

        await updateDoc(doc(db, 'progress', progressDocId), {
            completedLessons: completedLessons,
            updatedAt: new Date()
        });

        displayLessonsList();
        displayCurrentLesson();
    } catch (error) {
        console.error('Error updating progress:', error);
        alert('Error updating progress');
    }
}

// Update last accessed lesson
async function updateLastAccessedLesson() {
    if (!progressDocId) return;

    try {
        await updateDoc(doc(db, 'progress', progressDocId), {
            lastAccessedLesson: currentLessonIndex,
            updatedAt: new Date()
        });
    } catch (error) {
        console.error('Error updating last accessed lesson:', error);
    }
}

// Navigation functions
function nextLesson() {
    if (currentLessonIndex < courseData.lessons.length - 1) {
        currentLessonIndex++;
        updateUrl();
        displayLessonsList();
        displayCurrentLesson();
    }
}

function prevLesson() {
    if (currentLessonIndex > 0) {
        currentLessonIndex--;
        updateUrl();
        displayLessonsList();
        displayCurrentLesson();
    }
}

// Export functions to window for inline onclick handlers
window.lessonView = {
    toggleComplete,
    nextLesson,
    prevLesson
};

// Initialize
document.addEventListener('DOMContentLoaded', initLessonView);
