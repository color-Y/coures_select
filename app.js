const express = require('express');
const path = require('path');
const session = require('express-session');
const db = require('./sql');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 设置 EJS 作为模板引擎
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 会话中间件配置
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// 登录处理
app.post('/login/main', (req, res) => {
    const { userName, userPwd } = req.body;

    // 查询学生表
    db.query('SELECT * FROM students WHERE username = ? AND password = ?', [userName, userPwd], (err, studentResult) => {
        if (err) {
            console.error('查询错误:', err);
            return res.status(500).json({ success: false, message: '服务器错误' });
        } else if (studentResult.length > 0) {
            req.session.userId = studentResult[0].ID;
            req.session.userRole = 'student';
            return res.redirect('/student_main');
        } else {
            // 查询教师表
            db.query('SELECT * FROM teachers WHERE username = ? AND password = ?', [userName, userPwd], (err, teacherResult) => {
                if (err) {
                    console.error('查询错误:', err);
                    return res.status(500).json({ success: false, message: '服务器错误' });
                } else if (teacherResult.length > 0) {
                    req.session.userId = teacherResult[0].ID;
                    req.session.userRole = 'teacher';
                    return res.redirect('/teacher_main');
                } else {
                    return res.status(403).json({ success: false, message: '用户名或密码错误' });
                }
            });
        }
    });
});

// 选课处理
app.post('/enroll', (req, res) => {
    const userId = req.session.userId;
    let courseIds = req.body.courseId;

    if (!userId) {
        return res.status(403).json({ success: false, message: '未登录' });
    }

    // 输出请求体，调试用
    console.log('请求体:', req.body);

    // 确保 courseIds 是数组
    if (!Array.isArray(courseIds)) {
        courseIds = [courseIds]; // 如果只有一个课程，转换为数组
    }

    // 查询已选课程
    db.query('SELECT course_id FROM enrollments WHERE student_id = ?', [userId], (err, results) => {
        if (err) {
            console.error('查询错误:', err);
            return res.status(500).json({ success: false, message: '服务器错误' });
        }

        const existingEnrollments = results.map(row => Number(row.course_id));
        const errors = [];
        const insertPromises = [];

        // 检查是否已选
        courseIds.forEach(courseId => {
            // 检查 courseId 是否有效
            if (courseId === undefined || courseId === null) {
                errors.push('课程 ID 不能为空');
                return; // 跳过无效的 ID
            }

            const numericCourseId = Number(courseId);
            if (isNaN(numericCourseId)) {
                errors.push(`课程 ID ${courseId} 不是有效的数字`);
                return; // 跳过无效的 ID
            }

            if (existingEnrollments.includes(numericCourseId)) {
                errors.push(`课程 ID ${numericCourseId} 已经选过了`);
            } else {
                const insertPromise = new Promise((resolve, reject) => {
                    db.query('INSERT INTO enrollments (student_id, course_id) VALUES (?, ?)', [userId, numericCourseId], (err) => {
                        if (err) {
                            console.error(`插入错误: ${err.message}`);
                            errors.push(`选课失败，课程 ID ${numericCourseId} 可能出现了其他错误: ${err.message}`);
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                });
                insertPromises.push(insertPromise);
            }
        });

        // 处理插入操作
        Promise.all(insertPromises)
            .then(() => {
                if (errors.length > 0) {
                    return res.json({ success: false, message: errors.join(', ') });
                }
                res.json({ success: true, message: '选课成功！' });
            })
            .catch(() => {
                res.json({ success: false, message: errors.join(', ') });
            });
    });
});

// 获取我的课程
app.get('/my_courses', (req, res) => {
    const userId = req.session.userId;

    if (!userId) {
        return res.status(403).json({ success: false, message: '未登录' });
    }

    const query = `
        SELECT c.ID, c.course_name, c.class_time, c.day_of_week, t.name AS teacher_name
        FROM enrollments e
                 JOIN courses c ON e.course_id = c.ID
                 JOIN teachers t ON c.teacher_id_c = t.ID
        WHERE e.student_id = ?
    `;
    db.query(query, [userId], (err, results) => {
        if (err) {
            console.error('查询错误:', err);
            return res.status(500).json({ success: false, message: '服务器错误' });
        }
        res.json(results);
    });
});

// 删除课程
app.delete('/delete_course', (req, res) => {
    const userId = req.session.userId;
    const courseId = req.query.courseId;

    if (!userId) {
        return res.status(403).json({ success: false, message: '未登录' });
    }

    const query = 'DELETE FROM enrollments WHERE student_id = ? AND course_id = ?';
    db.query(query, [userId, courseId], (err) => {
        if (err) {
            console.error('删除错误:', err);
            return res.status(500).json({ success: false, message: '服务器错误' });
        }
        res.json({ success: true, message: '课程删除成功' });
    });
});

// 学生主页
app.get('/student_main', (req, res) => {
    const userId = req.session.userId;
    const keyword = req.query.keyword || '';

    if (!userId) {
        return res.status(403).send('未登录');
    }

    let query = 'SELECT * FROM courses';
    let queryParams = [];

    if (keyword) {
        query += ' WHERE course_name LIKE ?';
        queryParams.push(`%${keyword}%`);
    }

    db.query(query, queryParams, (err, courses) => {
        if (err) {
            console.error('查询错误:', err);
            return res.status(500).send('服务器错误');
        }

        db.query('SELECT course_id FROM enrollments WHERE student_id = ?', [userId], (err, enrollments) => {
            if (err) {
                console.error('查询错误:', err);
                return res.status(500).send('服务器错误');
            }

            const enrolledCourseIds = enrollments.map(row => Number(row.course_id));
            const coursesWithEnrollmentStatus = courses.map(course => ({
                ...course,
                enrolled: enrolledCourseIds.includes(course.ID)
            }));

            res.render('student_main', { courses: coursesWithEnrollmentStatus, keyword });
        });
    });
});

// 教师主页
app.get('/teacher_main', (req, res) => {
    const userId = req.session.userId;

    if (!userId) {
        return res.status(403).send('未登录');
    }

    res.render('teacher_main', { title: '教师主界面' });
});

// 首页
app.get('/', (req, res) => {
    res.render('index', { title: '首页', username: '访客' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`服务器正在运行在 http://localhost:${PORT}`);
});