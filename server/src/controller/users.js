const {
  verificationToken,
  findUserByEmail,
  saveUserInDB,
  updateUserByName,
  updatePassword,
  updateUserEmail,
  findUsers,
  getUserById,
  getAllTeachers,
  addStudentToTeacher,
  findStudents,
  getTeacher,
  deleteStudent,
  getTeachersRolesFromDB,
  findTeacherByName,
} = require("../dbQueries/queries");
const { resetPasswordEmail } = require("../middleware/resetPasswordEmail");
const { sendVerificationEmail } = require("../middleware/verificationEmail");
const { verifyToken } = require("../middleware/verifyToken");
const User = require("../model/user");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const Message = require("../model/Message");

const newUser = async (req, res) => {
  const { name, email, password, role, professional } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).send("يجب إدخال البيانات أولا");
  }
  if (role === "admin") {
    return res.status(201).send({ message: "تم الحفظ بنجاح أيها الهاكر" });
  }
  const user = new User({ ...req.body });
  try {
    await saveUserInDB(user);

    const token = jwt.sign(
      { _id: user._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    await sendVerificationEmail(req.body.email, token);
    res.send({
      msg: "تم إنشاء الحساب بنجاح ، من قضلك راجع بريدك الإلكتروني لتفعيل الحساب",
    });
  } catch (err) {
    res.status(500).send({ err: err.message });
  }
};

const verificationEmail = async (req, res) => {
  try {
    const token = req.params.token;
    // // console.log(token);
    const tokenVerified = await verificationToken(token);

    if (!tokenVerified) {
      return res.send({ error: "Your token has been expired" });
    }
    res.redirect("https://tahfeeth.vercel.app/verified");
  } catch (e) {
    res.status(500).send({ error: e.message });
  }
};

const internalSignup = async (req, res) => {
  try {
    const { name, email, password, age } = req.body;
    if (!name || !email || !password) {
      return res.status(400).send({ err: "يجب إدخال البيانات أولا" });
    }
    if (req.body.role === "student") {
      const student = new User({
        name: req.body.name,
        email: req.body.email,
        password: req.body.password,
        age: req.body.age,
        role: "student",
        verified: true,
        status: "verified",
      });
      const isTeacher = req.user[0].role === "teacher";
      let teacherId;
      if (isTeacher) {
        teacherId = req.user[0]._id;
      } else {
        teacherId = req.body.id;
      }
      await addStudentToTeacher(teacherId, student._id);
      await student.save();
      return res.status(201).send({ message: "تمت إضافة الطالب" });
    }
    // const teacher = new User(req.body);
    // await teacher.save();
    // return res.status(201).send({ message: "تمت إضافة المعلم" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const loginUser = async (req, res) => {
  try {
    const user = await User.findByCredentials(
      req.body.email,
      req.body.password
    );

    if (!user) {
      return res.status(404).send({ message: "معلومات خاطئة" });
    }

    const accessToken = await user.createAuthToken();
    const refreshToken = await user.createRefreshToken();
    res.send({ accessToken, refreshToken });
  } catch (error) {
    res.status(401).send({ message: error.message });
  }
};

const logoutUser = async (req, res) => {
  try {
    if (req.user.length > 0) {
      req.user[0].tokens = req.user[0]?.tokens.filter(
        (token) => token.token !== req.token
      );

      await req.user[0].save();
      return res.send({ message: "You logged out" });
    }

    res.send("the user is not found");
  } catch (err) {
    res.status(500).json({ err });
  }
};

const forgetPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await findUserByEmail(email);
    if (!user) {
      return res
        .status(400)
        .send({ message: "هذا البريد الإلكتروني غير مسجل" });
    }

    const token = await user.createResetPasswordToken();
    resetPasswordEmail(email, token, user.name);
    res.send({
      message:
        "تم إرسال ايميل إلى عنوان بريدك الإلكتروني من فضلك اذهب إلى بريدك الإلكتروني لإعادة تعيين كلمة السر",
    });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};
let user = null;
const verifyResetPasswordToken = async (req, res) => {
  try {
    const token = req.params.token;
    const decoded = await jwt.verify(token, process.env.RESET_PASSWORD_SECRET);
    if (!decoded) {
      throw new Error("token has been expired");
    }
    user = await User.findOne({ _id: decoded._id });
    res.redirect("https://tahfeeth.vercel.app/reset-password");
  } catch (err) {
    res.status(500).send({ err: err.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const token = req.header("Authorization").replace("Bearer ", "");
    const decoded = jwt.verify(token, process.env.RESET_PASSWORD_SECRET);

    const user = await User.findOne({ _id: decoded._id });

    if (!user) return res.status(400).send({ error: "user is not exist" });

    await updatePassword(user._id, req.body.password);

    user.resetPasswordToken = undefined;

    res.send({ message: "password has been updated" });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
};

const newToken = async (req, res) => {
  try {
    const user = req.user[0];
    const accessToken = await user.createAuthToken();
    res.send({ accessToken });
  } catch (e) {
    res.status.send({ error: e });
  }
};

const updateUsername = async (req, res) => {
  const { name } = req.body;
  try {
    const updatedUser = await updateUserByName(req.user[0]._id, name);
    res.send(updatedUser);
  } catch (err) {
    res.status(500).send({ err: err.message });
  }
};

const updateEmail = async (req, res) => {
  const { email } = req.body;
  const user = req.user[0];
  try {
    if (!user) return res.send({ message: "Email is not found" });
    if (email === user.email) {
      const updatedEmail = await updateUserEmail(user._id, email);
      const token = await user.createAuthToken();
      sendVerificationEmail(user.email, token);
      res.send({
        message:
          "email has been sent to your new email, please go to your mail and verify your account",
      });
    } else {
      return res.status(404).send({ error: "email is not found" });
    }
  } catch (err) {
    res.status(500).send({ err });
  }
};

const updateUserPassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const user = req.user[0];
  try {
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) return res.status(400).send({ error: "كلمة السر غير صحيحة" });

    await updatePassword(user._id, newPassword);
    res.send({ message: "تم تحديث كلمة السر" });
  } catch (err) {
    res.status(500).send({ err });
  }
};

// END OF AUTHENTICATION

// FOR ADMIN

const getUsers = async (req, res) => {
  try {
    if (req.user[0].role === "admin") {
      const users = await findUsers();

      res.send(users);
    } else {
      res.status(400).send({ message: "you're not the admin" });
    }
  } catch (e) {
    // // console.log(e);
    res.status(500).send({ e: e.message });
  }
};

const joinToTeacher = async (req, res) => {
  try {
    const teacherId = req.params.id;
    const studentId = req.user[0]._id;
    // // console.log(teacherId, studentId);

    if (req.user[0].role !== "student") {
      return res.status(400).send({ error: "أنت لست طالبا" });
    }

    const newStudents = await addStudentToTeacher(teacherId, studentId);
    // // console.log(newStudents);

    res.send({ newStudents });
  } catch (err) {
    // // console.log(err);
    res.status(500).send({ err: err.message });
  }
};

// FOR TEACHER

// for teachers
const getStudents = async (req, res) => {
  try {
    const isTeacher =
      req.user[0].role === "teacher" || req.user[0].role === "admin";
    if (!isTeacher) {
      res.status(400).send({ error: "You are not a teacher" });
    }

    const teacherId = req.params.id;
    const students = await findStudents(teacherId);
    const result = [];
    students.forEach((student) => {
      result.push({
        _id: student._id,
        name: student.name,
        email: student.email,
        role: student.role,
        avatar: student.avatar,
      });
    });
    res.send({ students: result });
  } catch (err) {
    res.status(500).send({ err });
  }
};

const addUser = async (req, res) => {
  try {
    if (req.user[0].role !== "admin") {
      return res.status(400).send({ error: "أنت لست مدير المنصة" });
    }
    const {
      name,
      email,
      password,
      age,
      role,
      information,
      price,
      professional,
      teacherId,
    } = req.body;

    if (req.body.role === "teacher") {
      if (
        !name ||
        !email ||
        !password ||
        !age ||
        !role ||
        !information ||
        !price ||
        !professional
      ) {
        return res.status(400).send({ error: "أدخل المعلومات كاملة" });
      }
      const newUser = {
        ...req.body,
        verified: true,
      };
      const user = new User(newUser);
      await user.save();
      res.send(user);
    }

    if (req.body.role === "student") {
      if (!name || !email || !password || !age || !teacherId) {
        return res.status(400).send({ error: "أدخل المعلومات كاملة" });
      }
      // // console.log(teacherId);
      const newUser = {
        ...req.body,
        verified: true,
        teacherId: undefined,
      };
      const student = await User.create(newUser);
      await addStudentToTeacher(teacherId, student._id);
      return res.status(201).send({ message: "تمت إضافة الطالب" });
    }
  } catch (e) {
    res.status(500).send({ error: e.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const isAdmin = req.user[0].role === "admin";
    if (isAdmin) {
      const user = await User.findByIdAndDelete(req.params.id);
      if (!user) {
        throw new Error("User is not found");
      } else {
        res.send({ message: "User has been deleted" });
      }
    } else {
      res.status(400).send({ error: "You're not the admin" });
    }
  } catch (e) {
    res.status(500).send({ error: e.message });
  }
};

const getUser = async (req, res) => {
  try {
    res.send(req.user);
  } catch (err) {
    res.status(500).send({ err: err.message });
  }
};

const joinStudent = async (req, res) => {
  try {
    const { studentId, teacherId } = req.body;

    const user = await User.findOne({ _id: studentId });
    // // console.log(user.role);
    if (user.role !== "student") {
      return res.status(400).send({ error: "you are not a student" });
    }

    await addStudentToTeacher(studentId, teacherId);
    res.send({ message: "you have been added to this teacher" });
  } catch (err) {
    // // console.log(err);
    res.status(500).send({ err: err.messaga });
  }
};

const getOneUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    // // console.log(user);
    res.send(user);
  } catch (err) {
    // // console.log(err);
    res.status(500).send(err);
  }
};

const getTeachers = async (req, res) => {
  try {
    const teachers = await getAllTeachers();
    const result = [];
    for (let i = 0; i < teachers.length; i++) {
      result.push({
        _id: teachers[i]._id,
        name: teachers[i].name,
        role: teachers[i].role,
        professional: teachers[i].professional,
        price: teachers[i].price,
        information: teachers[i].information,
        avatar: teachers[i].avatar,
      });
    }
    res.send(result);
  } catch (err) {
    res.status(500).send({ err: err.message });
  }
};

const getOneTeacher = async (req, res) => {
  try {
    const id = req.params.id;
    const teacher = await getTeacher(id);
    if (!teacher) {
      res.status(500).send({ error: "this is not a teacher" });
    }
    let result = {};
    result._id = teacher._id;
    result.name = teacher.name;
    result.role = teacher.role;
    result.professional = teacher.professional;
    result.price = teacher.price;
    result.information = teacher.information;
    result.avatar = teacher.avatar;
    res.send({ teacher: result, studentsNumber: teacher.students.length });
  } catch (err) {
    res.status(500).send({ err: err.message });
  }
};

const uploadAvatar = async (req, res) => {
  try {
    const base64Data = req.file.buffer.toString("base64");
    imgsrc = `data:${req.file.mimetype};base64,${base64Data}`;

    // // console.log(req.file);

    req.user[0].avatar = imgsrc;
    await req.user[0].save();

    let user = {};
    // user = req.user[0];

    user.avatar = req.user[0].avatar;

    // res.set({ "Content-Type": "image/jpeg" });
    res.send({
      message: "image has been uploaded",
      user,
    });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

const deleteStd = async (req, res) => {
  try {
    const teacher = req.user[0];
    const stdId = req.params.id;
    const isTeacher = teacher.role === "teacher" || teacher.role === "admin";
    if (!isTeacher) {
      res.status(400).send({ error: "you're not a teacher" });
    }
    const users = await deleteStudent(teacher._id, stdId);
    if (!users) return res.status(400).send({ error: "Student is not found" });
    // // console.log(users);
    res.send({ message: "user has been deleted" });
  } catch (err) {
    res.status(500).send({ err: err.message });
  }
};

const getAllStatusTeachers = async (req, res) => {
  try {
    const teachers = await getTeachersRolesFromDB();

    res.send(teachers);
  } catch (err) {
    res.status(500).send({ error: "internal server error" });
  }
};

const getTeacherSearch = async (req, res) => {
  try {
    const teacherWord = req.query.name;
    const teacher = await findTeacherByName(teacherWord);
    if (!teacher) return res.status(500).send({ err: "Teacher is not found" });
    res.send(teacher);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

module.exports = {
  newUser,
  verificationEmail,
  internalSignup,
  loginUser,
  logoutUser,
  forgetPassword,
  resetPassword,
  newToken,
  updateUsername,
  updateEmail,
  updateUserPassword,
  getUsers,
  addUser,
  deleteUser,
  getUser,
  getOneUser,
  getStudents,
  joinStudent,
  joinToTeacher,
  getTeachers,
  getOneTeacher,
  uploadAvatar,
  deleteStd,
  getAllStatusTeachers,
  verifyResetPasswordToken,
  getTeacherSearch,
};
