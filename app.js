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
    secret: 'your_secret_key', // 请替换为你的密钥
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // 如果使用 HTTPS，请设置为 true
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 登录处理
app.post('/login/main', (req, res) => {
    var val = req.body;
    var userName = val.userName;
    var userPwd = val.userPwd;

    // 查询学生表
    db.query('SELECT * FROM students WHERE username = ? AND password = ?', [userName, userPwd], function(err, studentResult) {
        if (err) {
            throw err;
        } else if (studentResult.length > 0) {
            // 找到学生，保存 student ID 到 session
            req.session.userId = studentResult[0].ID; // 保存 studentId
            req.session.userRole = 'student'; // 存储用户角色
            return res.redirect('/student_main'); // 重定向到学生主页面
        } else {
            // 查询教师表
            db.query('SELECT * FROM teachers WHERE username = ? AND password = ?', [userName, userPwd], function(err, teacherResult) {
                if (err) {
                    throw err;
                } else if (teacherResult.length > 0) {
                    // 找到教师，保存 teacher ID 到 session
                    req.session.userId = teacherResult[0].ID; // 保存 teacherId
                    req.session.userRole = 'teacher'; // 存储用户角色
                    return res.redirect('/teacher_main'); // 重定向到教师主页面
                } else {
                    // 用户名或密码错误
                    return res.send("用户名或密码错误");
                }
            });
        }
    });
});

// 选课处理
app.post('/enroll', (req, res) => {
    const userId = req.session.userId; // 获取用户 ID
    const courseId = req.body.courseId;

    if (!userId) {
        return res.status(403).send('未登录');
    }

    // 插入选课记录
    db.query('INSERT INTO enrollment (student_id, course_id) VALUES (?, ?)', [userId, courseId], (err) => {
        if (err) {
            return res.send("选课失败，可能已经选过该课程");
        }
        res.redirect('/student_main');
    });
});

// 首页
app.get('/', (req, res) => {
    res.render('index', { title: '首页', username: '访客' });
});

// 学生主页面
app.get('/student_main', (req, res) => {
    const userId = req.session.userId;

    if (!userId) {
        return res.status(403).send('未登录');
    }

    db.query('SELECT * FROM courses', (err, courses) => {
        if (err) {
            console.error('查询错误:', err);
            return res.status(500).send('服务器错误');
        }

        // 在这里打印课程数据
        console.log('课程数据:', JSON.stringify(courses, null, 2)); // 调试输出课程数据

        res.render('student_main', {courses: courses });
    });
});

// 教师主页面
app.get('/teacher_main', (req, res) => {
    const userId = req.session.userId;

    if (!userId) {
        return res.status(403).send('未登录');
    }

    // 获取教师相关数据
    res.render('teacher_main', { title: '教师主界面' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`服务器正在运行在 http://localhost:${PORT}`);
});
