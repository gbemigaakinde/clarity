import { auth, db } from './firebase-config.js';
import {
    collection, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc,
    query, where
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { requireAdmin } from './auth.js';
import { transformImageUrl, validateImageUrl } from './image-utils.js';

// ── State ──
let allCourses = [];
let editingCourseId = null;
let editingCourseData = null;
let editingModuleId = null;

// ── Utils ──
function generateId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ── Toast ──
function toast(msg, type = 'info') {
    let region = document.querySelector('.toast-region');
    if (!region) {
        region = document.createElement('div');
        region.className = 'toast-region';
        document.body.appendChild(region);
    }
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    const icon = type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle';
    el.innerHTML = `<i class="fas fa-${icon}"></i> ${msg}`;
    region.appendChild(el);
    setTimeout(() => {
        el.classList.add('toast--out');
        setTimeout(() => el.remove(), 300);
    }, type === 'error' ? 5000 : 3500);
}

// ── Modal helpers ──
function openModal(id) {
    document.getElementById(id)?.classList.add('is-open');
}

function closeModal(id) {
    document.getElementById(id)?.classList.remove('is-open');
}

function closeAllModals() {
    document.querySelectorAll('.modal-backdrop.is-open').forEach(m => m.classList.remove('is-open'));
}

// ── Init ──
async function init() {
    const ok = await requireAdmin();
    if (!ok) return;

    loadStats();
    loadCourses();
    setupModals();
    setupSearch();
}

// ── Stats ──
async function loadStats() {
    try {
        const [courses, users, enrollments] = await Promise.all([
            getDocs(collection(db, 'courses')),
            getDocs(collection(db, 'users')),
            getDocs(collection(db, 'enrollments'))
        ]);

        document.getElementById('statTotalCourses').textContent = courses.size;
        document.getElementById('statTotalEnrollments').textContent = enrollments.size;

        let students = 0;
        users.forEach(d => { if (d.data().role === 'student') students++; });
        document.getElementById('statTotalStudents').textContent = students;
    } catch (err) {
        console.error(err);
    }
}

// ── Courses ──
async function loadCourses() {
    const list = document.getElementById('coursesList');
    if (!list) return;

    list.innerHTML = '<p class="loading-text">Loading courses…</p>';

    try {
        const snap = await getDocs(collection(db, 'courses'));
        allCourses = [];
        snap.forEach(d => allCourses.push({ id: d.id, ...d.data() }));
        renderCourses(allCourses);
    } catch (err) {
        console.error(err);
        list.innerHTML = '<p class="loading-text">Error loading courses.</p>';
    }
}

function renderCourses(courses) {
    const list = document.getElementById('coursesList');
    if (!list) return;

    if (!courses.length) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-state__icon"><i class="fas fa-graduation-cap"></i></div>
                <h3 class="empty-state__title">No courses yet</h3>
                <p class="empty-state__desc">Create your first course to get started.</p>
            </div>`;
        return;
    }

    list.innerHTML = '';
    courses.forEach(course => list.appendChild(buildAdminCard(course)));
}

function buildAdminCard(course) {
    const wrap = document.createElement('div');
    wrap.className = 'admin-course-card';

    const thumb = transformImageUrl(course.thumbnail || '');
    const moduleCount = course.modules?.length || 0;
    const lessonCount = course.modules?.reduce((s, m) => s + (m.lessons?.length || 0), 0) || 0;
    const status = course.published
        ? '<span class="badge badge--success"><i class="fas fa-circle" style="font-size:7px"></i> Published</span>'
        : '<span class="badge badge--draft"><i class="fas fa-circle" style="font-size:7px"></i> Draft</span>';

    wrap.innerHTML = `
        <div class="admin-course-card__thumb">
            <img src="${thumb}" alt="${course.title}"
                 onerror="this.onerror=null;this.src='https://via.placeholder.com/200x120/f4f4f8/999?text=No+Image'">
        </div>
        <div class="admin-course-card__info">
            <div class="admin-course-card__title">${course.title}</div>
            <div class="admin-course-card__meta">
                ${status}
                <span><i class="fas fa-tag"></i> ${course.category}</span>
                <span><i class="fas fa-dollar-sign"></i> ${course.price}</span>
                <span><i class="fas fa-layer-group"></i> ${moduleCount} modules</span>
                <span><i class="fas fa-play-circle"></i> ${lessonCount} lessons</span>
            </div>
        </div>
        <div class="admin-course-card__actions">
            <button class="btn btn--secondary btn--sm" onclick="adminPanel.manageModules('${course.id}')">
                <i class="fas fa-list"></i> Modules
            </button>
            <button class="btn btn--ghost btn--sm" onclick="adminPanel.editCourse('${course.id}')">
                <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn--danger btn--sm" onclick="adminPanel.deleteCourse('${course.id}')">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    return wrap;
}

// ── Search ──
function setupSearch() {
    const input = document.getElementById('courseSearch');
    input?.addEventListener('input', debounce(() => {
        const q = input.value.toLowerCase();
        const filtered = !q ? allCourses : allCourses.filter(c =>
            c.title.toLowerCase().includes(q) ||
            c.category?.toLowerCase().includes(q) ||
            c.instructor?.toLowerCase().includes(q)
        );
        renderCourses(filtered);
    }, 300));
}

// ── Modal setup ──
function setupModals() {
    // Close on backdrop click
    document.querySelectorAll('.modal-backdrop').forEach(bd => {
        bd.addEventListener('click', (e) => {
            if (e.target === bd) bd.classList.remove('is-open');
        });
    });

    // Close buttons
    document.querySelectorAll('.modal__close').forEach(btn => {
        btn.addEventListener('click', () => closeAllModals());
    });

    // Create course button
    document.getElementById('createCourseBtn')?.addEventListener('click', () => openCourseModal());

    // Course form
    document.getElementById('courseForm')?.addEventListener('submit', handleCourseSave);
    document.getElementById('cancelCourseBtn')?.addEventListener('click', () => closeModal('courseModal'));

    // Module form
    document.getElementById('moduleForm')?.addEventListener('submit', handleModuleSave);
    document.getElementById('cancelModuleBtn')?.addEventListener('click', () => closeModal('moduleFormModal'));
    document.getElementById('addModuleBtn')?.addEventListener('click', () => openModuleFormModal());

    // Lesson form
    document.getElementById('lessonForm')?.addEventListener('submit', handleLessonSave);
    document.getElementById('cancelLessonBtn')?.addEventListener('click', () => closeModal('lessonFormModal'));
    document.getElementById('lessonType')?.addEventListener('change', e => toggleLessonFields(e.target.value));

    // Thumbnail validation
    const thumbInput = document.getElementById('courseThumbnail');
    if (thumbInput) {
        thumbInput.addEventListener('blur', validateThumb);
        thumbInput.addEventListener('input', debounce(validateThumb, 600));
    }
}

// ── Course modal ──
function openCourseModal(courseId = null) {
    editingCourseId = courseId;
    const form = document.getElementById('courseForm');
    form.reset();
    clearThumbValidation();

    document.getElementById('courseModalTitle').textContent = courseId ? 'Edit Course' : 'New Course';

    if (courseId) {
        const c = allCourses.find(x => x.id === courseId);
        if (c) {
            document.getElementById('courseTitle').value = c.title || '';
            document.getElementById('courseSlug').value = c.slug || '';
            document.getElementById('courseDescription').value = c.description || '';
            document.getElementById('courseCategory').value = c.category || '';
            document.getElementById('courseInstructor').value = c.instructor || '';
            document.getElementById('courseThumbnail').value = c.thumbnail || '';
            document.getElementById('coursePrice').value = c.price || '';
            document.getElementById('coursePublished').checked = c.published || false;
            document.getElementById('courseAccessType').value = c.accessConfig?.type || 'sequential';
            document.getElementById('courseAllowSkip').checked = c.accessConfig?.allowSkip || false;

            if (c.thumbnail) setTimeout(validateThumb, 150);
        }
    }

    openModal('courseModal');
}

async function validateThumb() {
    const input = document.getElementById('courseThumbnail');
    const url = input?.value.trim();
    clearThumbValidation();
    if (!url) return;

    const statusEl = document.getElementById('thumbStatus');
    const previewEl = document.getElementById('thumbPreview');

    statusEl.className = 'validation-status validation-status--loading';
    statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking URL…';
    statusEl.style.display = 'flex';

    try {
        const transformed = transformImageUrl(url);
        if (transformed !== url) input.value = transformed;

        const valid = await validateImageUrl(transformed);
        if (valid) {
            statusEl.className = 'validation-status validation-status--success';
            statusEl.innerHTML = '<i class="fas fa-check-circle"></i> Image loaded successfully';
            previewEl.src = transformed;
            previewEl.style.display = 'block';
        } else {
            statusEl.className = 'validation-status validation-status--error';
            statusEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> Could not load image from this URL';
        }
    } catch {
        statusEl.className = 'validation-status validation-status--error';
        statusEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> Invalid URL';
    }
}

function clearThumbValidation() {
    const statusEl = document.getElementById('thumbStatus');
    const previewEl = document.getElementById('thumbPreview');
    if (statusEl) { statusEl.style.display = 'none'; statusEl.textContent = ''; }
    if (previewEl) { previewEl.style.display = 'none'; previewEl.src = ''; }
}

async function handleCourseSave(e) {
    e.preventDefault();
    const btn = document.getElementById('saveCourseBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';

    const thumbRaw = document.getElementById('courseThumbnail').value.trim();
    const data = {
        title:       document.getElementById('courseTitle').value,
        slug:        document.getElementById('courseSlug').value,
        description: document.getElementById('courseDescription').value,
        category:    document.getElementById('courseCategory').value,
        instructor:  document.getElementById('courseInstructor').value,
        thumbnail:   transformImageUrl(thumbRaw),
        price:       parseFloat(document.getElementById('coursePrice').value),
        published:   document.getElementById('coursePublished').checked,
        accessConfig: {
            type:      document.getElementById('courseAccessType').value,
            allowSkip: document.getElementById('courseAllowSkip').checked
        },
        updatedAt: new Date()
    };

    try {
        if (editingCourseId) {
            await updateDoc(doc(db, 'courses', editingCourseId), data);
            toast('Course updated!', 'success');
        } else {
            data.createdAt = new Date();
            data.modules = [];
            await addDoc(collection(db, 'courses'), data);
            toast('Course created!', 'success');
        }
        closeModal('courseModal');
        loadCourses();
        loadStats();
    } catch (err) {
        console.error(err);
        toast('Save failed: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save Course';
    }
}

// ── Delete course ──
async function deleteCourse(courseId) {
    if (!confirm('Delete this course? This cannot be undone.')) return;

    try {
        await deleteDoc(doc(db, 'courses', courseId));

        // Clean up enrollments and progress
        const [enSnap, prSnap] = await Promise.all([
            getDocs(query(collection(db, 'enrollments'), where('courseId', '==', courseId))),
            getDocs(query(collection(db, 'progress'), where('courseId', '==', courseId)))
        ]);

        await Promise.all([
            ...enSnap.docs.map(d => deleteDoc(doc(db, 'enrollments', d.id))),
            ...prSnap.docs.map(d => deleteDoc(doc(db, 'progress', d.id)))
        ]);

        toast('Course deleted.', 'success');
        loadCourses();
        loadStats();
    } catch (err) {
        console.error(err);
        toast('Delete failed: ' + err.message, 'error');
    }
}

// ── Modules modal ──
async function manageModules(courseId) {
    editingCourseId = courseId;

    try {
        const snap = await getDoc(doc(db, 'courses', courseId));
        if (!snap.exists()) { toast('Course not found.', 'error'); return; }
        editingCourseData = { id: snap.id, ...snap.data() };

        document.getElementById('modulesCourseName').textContent = editingCourseData.title;
        renderModules(editingCourseData.modules || []);
        openModal('modulesModal');
    } catch (err) {
        console.error(err);
        toast('Error loading course.', 'error');
    }
}

function renderModules(modules) {
    const container = document.getElementById('modulesList');
    editingModuleId = null;

    if (!modules.length) {
        container.innerHTML = `
            <div class="empty-state" style="padding:var(--s-12) var(--s-6)">
                <div class="empty-state__icon"><i class="fas fa-layer-group"></i></div>
                <h3 class="empty-state__title">No modules yet</h3>
                <p class="empty-state__desc">Add your first module to start building this course.</p>
            </div>`;
        return;
    }

    const sorted = [...modules].sort((a, b) => a.order - b.order);
    container.innerHTML = '';

    sorted.forEach(mod => {
        const item = document.createElement('div');
        item.className = 'admin-module-item';
        const lessonCount = mod.lessons?.length || 0;

        item.innerHTML = `
            <div class="admin-module-item__header">
                <div>
                    <div class="admin-module-item__title">${mod.order}. ${mod.title}</div>
                    <div class="admin-module-item__meta">${mod.description || 'No description'} · ${lessonCount} lessons</div>
                </div>
                <div class="admin-module-item__actions">
                    <button class="btn btn--ghost btn--sm" onclick="adminPanel.manageLessons('${mod.id}')">
                        <i class="fas fa-list"></i> Lessons
                    </button>
                    <button class="btn btn--ghost btn--sm" onclick="adminPanel.editModule('${mod.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn--danger btn--sm" onclick="adminPanel.deleteModule('${mod.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
        container.appendChild(item);
    });
}

function openModuleFormModal(moduleId = null) {
    const form = document.getElementById('moduleForm');
    form.reset();

    document.getElementById('moduleModalTitle').textContent = moduleId ? 'Edit Module' : 'Add Module';

    if (moduleId) {
        const mod = editingCourseData.modules.find(m => m.id === moduleId);
        if (mod) {
            document.getElementById('moduleTitle').value = mod.title || '';
            document.getElementById('moduleDescription').value = mod.description || '';
            document.getElementById('moduleOrder').value = mod.order || 1;
            document.getElementById('moduleId').value = moduleId;
        }
    } else {
        const nextOrder = (editingCourseData.modules?.length || 0) + 1;
        document.getElementById('moduleOrder').value = nextOrder;
        document.getElementById('moduleId').value = '';
    }

    document.getElementById('moduleCourseId').value = editingCourseId;
    openModal('moduleFormModal');
}

async function handleModuleSave(e) {
    e.preventDefault();
    const btn = e.target.querySelector('[type="submit"]');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…'; }

    const moduleId = document.getElementById('moduleId').value;
    const modules = [...(editingCourseData.modules || [])];
    const data = {
        title:       document.getElementById('moduleTitle').value,
        description: document.getElementById('moduleDescription').value,
        order:       parseInt(document.getElementById('moduleOrder').value)
    };

    try {
        if (moduleId) {
            const idx = modules.findIndex(m => m.id === moduleId);
            if (idx === -1) throw new Error('Module not found');
            data.lessons = modules[idx].lessons || [];
            modules[idx] = { ...modules[idx], ...data };
        } else {
            data.id = generateId('module');
            data.lessons = [];
            modules.push(data);
        }

        await updateDoc(doc(db, 'courses', editingCourseId), { modules, updatedAt: new Date() });

        const fresh = await getDoc(doc(db, 'courses', editingCourseId));
        editingCourseData = { id: fresh.id, ...fresh.data() };

        renderModules(editingCourseData.modules);
        closeModal('moduleFormModal');
        loadCourses();
        toast(moduleId ? 'Module updated.' : 'Module added.', 'success');
    } catch (err) {
        console.error(err);
        toast('Save failed: ' + err.message, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Save Module'; }
    }
}

async function deleteModule(moduleId) {
    if (!confirm('Delete this module and all its lessons?')) return;

    try {
        const modules = [...(editingCourseData.modules || [])];
        const idx = modules.findIndex(m => m.id === moduleId);
        if (idx === -1) return;

        modules.splice(idx, 1);
        modules.forEach((m, i) => { m.order = i + 1; });

        await updateDoc(doc(db, 'courses', editingCourseId), { modules, updatedAt: new Date() });

        const fresh = await getDoc(doc(db, 'courses', editingCourseId));
        editingCourseData = { id: fresh.id, ...fresh.data() };

        renderModules(editingCourseData.modules);
        loadCourses();
        toast('Module deleted.', 'success');
    } catch (err) {
        console.error(err);
        toast('Delete failed: ' + err.message, 'error');
    }
}

// ── Lessons ──
function manageLessons(moduleId) {
    editingModuleId = moduleId;
    const mod = editingCourseData.modules.find(m => m.id === moduleId);
    if (!mod) { toast('Module not found.', 'error'); return; }

    const container = document.getElementById('modulesList');
    container.innerHTML = `
        <div style="margin-bottom:var(--s-5);padding-bottom:var(--s-5);border-bottom:1px solid var(--ink-100)">
            <button class="btn btn--ghost btn--sm" onclick="adminPanel.backToModules()" style="margin-bottom:var(--s-3)">
                <i class="fas fa-arrow-left"></i> Back to Modules
            </button>
            <h3 style="font-size:var(--text-base);font-weight:700;color:var(--ink-900);margin-bottom:var(--s-1)">
                Module ${mod.order}: ${mod.title}
            </h3>
            <p style="font-size:var(--text-xs);color:var(--ink-400)">${mod.description || 'Manage lessons for this module'}</p>
        </div>
        <button class="btn btn--primary btn--sm" onclick="adminPanel.openLessonFormModal()" style="margin-bottom:var(--s-5)">
            <i class="fas fa-plus"></i> Add Lesson
        </button>
        <div id="lessonsList"></div>
    `;

    renderLessons(mod.lessons || []);
}

function renderLessons(lessons) {
    const container = document.getElementById('lessonsList');
    if (!container) return;

    if (!lessons.length) {
        container.innerHTML = `<p style="text-align:center;color:var(--ink-400);font-size:var(--text-sm);padding:var(--s-8) 0">No lessons yet. Add your first lesson.</p>`;
        return;
    }

    const sorted = [...lessons].sort((a, b) => a.order - b.order);
    container.innerHTML = '';

    sorted.forEach(lesson => {
        const item = document.createElement('div');
        item.className = 'admin-lesson-item';

        const typeIcons = { video: 'fa-video', text: 'fa-file-alt', mixed: 'fa-layer-group' };
        const icon = typeIcons[lesson.type] || 'fa-file';

        item.innerHTML = `
            <div>
                <div class="admin-lesson-item__title">
                    <i class="fas ${icon}" style="color:var(--ink-400);margin-right:var(--s-2)"></i>
                    ${lesson.order}. ${lesson.title}
                </div>
                <div class="admin-lesson-item__meta">
                    ${lesson.type || 'text'} ${lesson.duration ? '· ' + lesson.duration + ' min' : ''} · ${lesson.accessRule || 'sequential'}
                </div>
            </div>
            <div class="admin-lesson-item__actions">
                <button class="btn btn--ghost btn--sm" onclick="adminPanel.editLesson('${lesson.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn--danger btn--sm" onclick="adminPanel.deleteLesson('${lesson.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        container.appendChild(item);
    });
}

function backToModules() {
    editingModuleId = null;
    renderModules(editingCourseData.modules || []);
}

function openLessonFormModal(lessonId = null) {
    const form = document.getElementById('lessonForm');
    form.reset();

    const mod = editingCourseData.modules.find(m => m.id === editingModuleId);
    if (!mod) { toast('Module not found.', 'error'); return; }

    document.getElementById('lessonModalTitle').textContent = lessonId ? 'Edit Lesson' : 'Add Lesson';

    if (lessonId) {
        const lesson = mod.lessons?.find(l => l.id === lessonId);
        if (lesson) {
            document.getElementById('lessonTitle').value = lesson.title || '';
            document.getElementById('lessonOrder').value = lesson.order || 1;
            document.getElementById('lessonType').value = lesson.type || 'text';
            document.getElementById('lessonVideoUrl').value = lesson.videoUrl || '';
            document.getElementById('lessonContent').value = lesson.content || '';
            document.getElementById('lessonDuration').value = lesson.duration || '';
            document.getElementById('lessonAccessRule').value = lesson.accessRule || 'sequential';
            document.getElementById('lessonId').value = lessonId;
            toggleLessonFields(lesson.type || 'text');
        }
    } else {
        const nextOrder = (mod.lessons?.length || 0) + 1;
        document.getElementById('lessonOrder').value = nextOrder;
        document.getElementById('lessonId').value = '';
        document.getElementById('lessonType').value = 'text';
        document.getElementById('lessonAccessRule').value = editingCourseData.accessConfig?.type || 'sequential';
        toggleLessonFields('text');
    }

    document.getElementById('lessonCourseId').value = editingCourseId;
    document.getElementById('lessonModuleId').value = editingModuleId;
    openModal('lessonFormModal');
}

function toggleLessonFields(type) {
    const videoGroup   = document.getElementById('videoUrlGroup');
    const contentGroup = document.getElementById('contentGroup');
    const videoInput   = document.getElementById('lessonVideoUrl');
    const contentInput = document.getElementById('lessonContent');

    if (type === 'video') {
        videoGroup.style.display   = 'block';
        contentGroup.style.display = 'none';
        videoInput.required   = true;
        contentInput.required = false;
    } else if (type === 'text') {
        videoGroup.style.display   = 'none';
        contentGroup.style.display = 'block';
        videoInput.required   = false;
        contentInput.required = true;
    } else {
        videoGroup.style.display   = 'block';
        contentGroup.style.display = 'block';
        videoInput.required   = true;
        contentInput.required = true;
    }
}

async function handleLessonSave(e) {
    e.preventDefault();
    const btn = e.target.querySelector('[type="submit"]');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…'; }

    const lessonId = document.getElementById('lessonId').value;
    const type = document.getElementById('lessonType').value;

    const data = {
        title:      document.getElementById('lessonTitle').value,
        order:      parseInt(document.getElementById('lessonOrder').value),
        type,
        duration:   parseInt(document.getElementById('lessonDuration').value) || null,
        accessRule: document.getElementById('lessonAccessRule').value
    };

    if (type === 'video' || type === 'mixed') {
        data.videoUrl = document.getElementById('lessonVideoUrl').value;
    }
    if (type === 'text' || type === 'mixed') {
        data.content = document.getElementById('lessonContent').value;
    }

    const modules = [...editingCourseData.modules];
    const modIdx = modules.findIndex(m => m.id === editingModuleId);
    if (modIdx === -1) { toast('Module not found.', 'error'); return; }

    const lessons = [...(modules[modIdx].lessons || [])];

    try {
        if (lessonId) {
            const idx = lessons.findIndex(l => l.id === lessonId);
            if (idx === -1) throw new Error('Lesson not found');
            lessons[idx] = { ...lessons[idx], ...data };
        } else {
            data.id = generateId('lesson');
            lessons.push(data);
        }

        modules[modIdx].lessons = lessons;
        await updateDoc(doc(db, 'courses', editingCourseId), { modules, updatedAt: new Date() });

        const fresh = await getDoc(doc(db, 'courses', editingCourseId));
        editingCourseData = { id: fresh.id, ...fresh.data() };

        const freshMod = editingCourseData.modules.find(m => m.id === editingModuleId);
        renderLessons(freshMod?.lessons || []);
        closeModal('lessonFormModal');
        loadCourses();
        toast(lessonId ? 'Lesson updated.' : 'Lesson added.', 'success');
    } catch (err) {
        console.error(err);
        toast('Save failed: ' + err.message, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Save Lesson'; }
    }
}

async function deleteLesson(lessonId) {
    if (!confirm('Delete this lesson?')) return;

    try {
        const modules = [...editingCourseData.modules];
        const modIdx = modules.findIndex(m => m.id === editingModuleId);
        if (modIdx === -1) return;

        const lessons = modules[modIdx].lessons?.filter(l => l.id !== lessonId) || [];
        lessons.forEach((l, i) => { l.order = i + 1; });
        modules[modIdx].lessons = lessons;

        await updateDoc(doc(db, 'courses', editingCourseId), { modules, updatedAt: new Date() });

        const fresh = await getDoc(doc(db, 'courses', editingCourseId));
        editingCourseData = { id: fresh.id, ...fresh.data() };

        const freshMod = editingCourseData.modules.find(m => m.id === editingModuleId);
        renderLessons(freshMod?.lessons || []);
        loadCourses();
        toast('Lesson deleted.', 'success');
    } catch (err) {
        console.error(err);
        toast('Delete failed: ' + err.message, 'error');
    }
}

// ── Expose ──
window.adminPanel = {
    editCourse: id => openCourseModal(id),
    deleteCourse,
    manageModules,
    editModule: openModuleFormModal,
    deleteModule,
    manageLessons,
    openLessonFormModal,
    editLesson: openLessonFormModal,
    deleteLesson,
    backToModules
};

document.addEventListener('DOMContentLoaded', init);
