const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
// app.use(cors());
app.use(cors({
  origin: "https://sitaramaccount.infinityfreeapp.com"
}));

app.use(express.json());

// MySQL connection
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});


db.connect((err) => {
  if (err) {
    console.error('❌ Database connection failed:', err);
    return;
  }
  console.log('✅ Connected to MySQL database');
});

// -------------------- Districts Route --------------------
app.get("/api/districts", (req, res) => {
  const sql = "SELECT dist_id, district FROM tbl_district ORDER BY district ASC";
  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching districts:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

// -------------------- Energy Club Route --------------------
app.get("/api/energy-club", (req, res) => {
  const { dist, from, to } = req.query;

  let sql = `
    SELECT d.district AS district_name, COUNT(c.enrclub_id) AS club_count
    FROM tbl_enrclub_name c
    JOIN tbl_district d ON c.district = d.dist_id
    WHERE 1
  `;
  const params = [];

  if (dist && Number(dist) !== 0) {
    sql += " AND c.district = ?";
    params.push(Number(dist));
  }
  if (from) {
    sql += " AND DATE(c.updated_date) >= ?";
    params.push(from);
  }
  if (to) {
    sql += " AND DATE(c.updated_date) <= ?";
    params.push(to);
  }

  sql += " GROUP BY d.district ORDER BY d.district ASC";

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error("Error fetching Energy Club data:", err);
      return res.status(500).json({ error: "Server error" });
    }
    res.json(results);
  });
});

app.get("/api/schools-by-filter", (req, res) => {
  const { district, fy, activity } = req.query;

  const [startYear, endYear] = fy.split("-");
  const fy_start = `${startYear}-04-01`;
  const fy_end = `${endYear}-03-31`;

  let sql = `
    SELECT 
        c.enrclub_id,
        c.enr_club_name AS school_name,
        c.hm_mobile AS contact_no,
        c.hm_name AS contact_name,
        COUNT(s.act_id) AS total_activities
    FROM tbl_enrclub_name c
    LEFT JOIN tbl_activitysubmission s 
        ON c.enrclub_id = s.enrclub_id
        AND s.submission_date BETWEEN ? AND ?
        ${activity && activity !== "0" ? "AND s.act_id = ?" : ""}
    WHERE 1
  `;

  const params = [fy_start, fy_end];

  if (activity && activity !== "0") params.push(activity);

  if (district && district !== "0") {
    sql += " AND c.district = ? ";
    params.push(district);
  }

  sql += `
    GROUP BY c.enrclub_id, c.enr_club_name, c.hm_mobile, c.hm_name
    ORDER BY c.enr_club_name ASC
  `;

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error("❌ Error loading school list", err);
      return res.status(500).json({ error: "Server error" });
    }
    res.json(results);
  });
});

app.get("/api/energy-club-pending", (req, res) => {
  const { dist, activity, fy_start, fy_end } = req.query;

  let sql = `
    SELECT 
      d.dist_id,
      d.district AS district_name,
      SUM(CASE WHEN s.enrclub_id IS NULL THEN 1 ELSE 0 END) AS not_submitted_count
    FROM tbl_enrclub_name c
    JOIN tbl_district d ON c.district = d.dist_id
    LEFT JOIN (
      SELECT DISTINCT enrclub_id
      FROM tbl_activitysubmission
      WHERE submission_date BETWEEN ? AND ?
      ${activity && activity !== "0" ? "AND act_id = ?" : ""}
    ) s ON c.enrclub_id = s.enrclub_id
    WHERE 1
  `;

  const params = [fy_start, fy_end];
  if (activity !== "0") params.push(activity);

  if (dist !== "0") {
    sql += " AND c.district = ? ";
    params.push(dist);
  }

  sql += `
    GROUP BY d.dist_id, d.district
    ORDER BY d.district ASC
  `;

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error("❌ Error in /energy-club-pending:", err);
      return res.status(500).json({ error: "Server error" });
    }
    res.json(results);
  });
});


app.get("/api/energy-club-filter", (req, res) => {
  const { dist, activity, fy_start, fy_end } = req.query;

  let sql = `
    SELECT 
      d.dist_id,
      d.district AS district_name,
      COUNT(DISTINCT c.enrclub_id) AS club_count
    FROM tbl_enrclub_name c
    JOIN tbl_district d ON c.district = d.dist_id
    LEFT JOIN tbl_activitysubmission s ON c.enrclub_id = s.enrclub_id
    WHERE 1
  `;

  const params = [];

  if (dist && dist !== "0") {
    sql += " AND c.district = ? ";
    params.push(dist);
  }

  if (activity && activity !== "0") {
    sql += " AND s.act_id = ? ";
    params.push(activity);
  }

  if (fy_start && fy_end) {
    sql += " AND s.submission_date BETWEEN ? AND ? ";
    params.push(fy_start, fy_end);
  }

  sql += " GROUP BY d.dist_id, d.district ORDER BY d.district ASC";

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error("❌ Error in /api/energy-club-filter:", err);
      return res.status(500).json({ error: "Server error" });
    }
    res.json(results);
  });
});




app.get("/api/district-name", (req, res) => {
  const { id } = req.query;
  db.query(
    "SELECT district FROM tbl_district WHERE dist_id = ?",
    [id],
    (err, results) => {
      if (err) return res.status(500).json({ error: "Server error" });
      if (results.length === 0) return res.json({ district: "Unknown" });
      res.json({ district: results[0].district });
    }
  );
});


// app.get("/api/custom-submission-summary", (req, res) => {

//   const sql = `
//     SELECT 
//       d.dist_id,
//       d.district AS district_name,
//       COUNT(c.id_custm) AS total_submissions
//     FROM tbl_enr_custm_image_vdo_up c
//     INNER JOIN tbl_enrclub_name e 
//       ON c.user_id = e.enruser_name
//     INNER JOIN tbl_district d
//       ON e.district = d.dist_id
//     WHERE c.submit_ces = 1
//     GROUP BY d.dist_id, d.district
//     ORDER BY d.district ASC
//   `;


//   db.query(sql, (err, results) => {
//     if (err) {
//       console.error("❌ Error fetching summary:", err);
//       return res.status(500).json({ error: "Server error" });
//     }

//     res.json(results);
//   });
// });

// server-api.js (add to your express app)
app.get("/api/custom-submission-summary", (req, res) => {
  const { dist, activity, fy_start, fy_end } = req.query;
  const params = [];

  let sql = `
    SELECT 
      d.dist_id,
      d.district AS district_name,
      COUNT(*) AS total_submissions
    FROM tbl_enr_custm_image_vdo_up c
    INNER JOIN tbl_enr_customizepgrm cp ON cp.eng_custom_id = c.img_vdo_id
    INNER JOIN tbl_enrclub_name e ON c.user_id = e.enruser_name
    INNER JOIN tbl_district d ON e.district = d.dist_id
    WHERE c.submit_ces = 1
  `;

  if (dist && dist !== "0") {
    sql += " AND d.dist_id = ? ";
    params.push(dist);
  }

  if (activity && activity !== "0") {
    sql += " AND cp.activity_id = ? ";
    params.push(activity);
  }

  if (fy_start && fy_end) {
    sql += " AND cp.from_date BETWEEN ? AND ? ";
    params.push(fy_start, fy_end);
  }

  sql += `
    GROUP BY d.dist_id, d.district
    ORDER BY d.district ASC
  `;

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ error: err.sqlMessage });
    res.json(results);
  });
});

app.get("/api/fund-allocation-summary", (req, res) => {
  let { dist, fy_start, fy_end } = req.query;

  // ------------------------------
  // ✅ If frontend did NOT send FY, return clear error
  // ------------------------------
  if (!fy_start || !fy_end) {
    return res.status(400).json({
      error: "Missing fy_start or fy_end. Please pass FY range.",
    });
  }

  // ------------------------------
  // ⭐ Base Query
  // ------------------------------
  let sql = `
    SELECT
    d.dist_id,
    d.district AS district_name,
    SUM(fa.allocation_amount) AS total_amount,
    fa.school_status
  FROM tbl_enr_allocate a
  INNER JOIN tbl_enr_fundallocation fa
    ON a.fundallocation_id = fa.fundallocation_id
  INNER JOIN tbl_district d
    ON a.dist_id = d.dist_id
  WHERE 1
    AND fa.allocation_date BETWEEN ? AND ?
  `;

  const params = [fy_start, fy_end];

  // ------------------------------
  // ⭐ District Filter
  // ------------------------------
  if (dist && dist !== "0") {
    sql += ` AND d.dist_id = ? `;
    params.push(dist);
  }

  // ------------------------------
  // ⭐ Grouping & Sorting
  // ------------------------------
  sql += `
    GROUP BY d.dist_id, d.district
    ORDER BY d.district ASC
  `;

  console.log("SQL:", sql);
  console.log("PARAMS:", params);

  // ------------------------------
  // ⭐ Execute
  // ------------------------------
  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ error: err.sqlMessage });
    res.json(results);
  });
});




// unified school-list that returns every school with count of submitted activities (0 if none)
app.get("/api/custom-school-list", (req, res) => {
  const { district, activity, fy_start, fy_end } = req.query;
  const params = [];

  // We use a scalar subquery to count submitted activities per school matching filters
  let sql = `
    SELECT
      e.enrclub_id,
      e.enr_club_name AS school_name,
      e.hm_name AS contact_name,
      e.hm_mobile AS contact_no,
      (
        SELECT COUNT(*)
        FROM tbl_enr_custm_image_vdo_up c
        INNER JOIN tbl_enr_customizepgrm cp ON cp.eng_custom_id = c.img_vdo_id
        WHERE c.user_id = e.enruser_name
          AND c.submit_ces = 1
  `;

  if (activity && activity !== "0") {
    sql += " AND cp.activity_id = ? ";
    params.push(activity);
  }

  if (fy_start && fy_end) {
    sql += " AND cp.from_date BETWEEN ? AND ? ";
    params.push(fy_start, fy_end);
  }

  sql += `
      ) AS total_activities
    FROM tbl_enrclub_name e
    WHERE 1
  `;

  if (district && district !== "0") {
    sql += " AND e.district = ? ";
    params.push(district);
  }

  sql += `
    ORDER BY e.enr_club_name ASC
  `;

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ error: err.sqlMessage });
    res.json(results);
  });
});
// 1) Summary: returns district-wise count of NOT submitted schools
app.get("/api/custom-notsubmission-summary", (req, res) => {
  const { dist, activity, fy_start, fy_end } = req.query;

  const params = [];
  let sql = `
    SELECT
      d.dist_id,
      d.district AS district_name,
      COUNT(*) AS total_submissions
    FROM tbl_district d
    JOIN tbl_enrclub_name e ON e.district = d.dist_id
    WHERE 1
  `;

  if (dist && dist !== "0") {
    sql += " AND d.dist_id = ? ";
    params.push(dist);
  }

  // only include clubs that DID NOT submit any record matching the filters
  sql += `
    AND e.enruser_name NOT IN (
      SELECT c.user_id
      FROM tbl_enr_custm_image_vdo_up c
      INNER JOIN tbl_enr_customizepgrm cp ON cp.eng_custom_id = c.img_vdo_id
      WHERE c.submit_ces = 1
  `;

  if (activity && activity !== "0") {
    sql += " AND cp.activity_id = ? ";
    params.push(activity);
  }

  if (fy_start && fy_end) {
    sql += " AND cp.from_date BETWEEN ? AND ? ";
    params.push(fy_start, fy_end);
  }

  sql += `
      GROUP BY c.user_id
    )
  `;

  sql += `
    GROUP BY d.dist_id, d.district
    ORDER BY d.district ASC
  `;

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ error: err.sqlMessage });
    res.json(results);
  });
});

// 2) List: returns the NOT submitted school list (respects district/activity/fy/status)
app.get("/api/custom-not-school-list", (req, res) => {
  const { district, activity, fy_start, fy_end, status } = req.query;

  const params = [];
  let sql = `
    SELECT
      e.enrclub_id,
      e.enr_club_name AS school_name,
      e.hm_name AS contact_name,
      e.hm_mobile AS contact_no,
      0 AS total_activities
    FROM tbl_enrclub_name e
    WHERE 1
  `;

  if (district && district !== "0") {
    sql += " AND e.district = ? ";
    params.push(district);
  }

  // if user asked for NOT submitted (default) — exclude those who have submitted matching records
  if (status !== "submitted") {
    sql += `
      AND e.enruser_name NOT IN (
        SELECT c.user_id
        FROM tbl_enr_custm_image_vdo_up c
        INNER JOIN tbl_enr_customizepgrm cp ON cp.eng_custom_id = c.img_vdo_id
        WHERE c.submit_ces = 1
    `;

    if (activity && activity !== "0") {
      sql += " AND cp.activity_id = ? ";
      params.push(activity);
    }

    if (fy_start && fy_end) {
      sql += " AND cp.from_date BETWEEN ? AND ? ";
      params.push(fy_start, fy_end);
    }

    sql += `
        GROUP BY c.user_id
      )
    `;
  } else {
    // if status === 'submitted', return schools that HAVE submitted (and include count)
    sql = `
      SELECT
        e.enrclub_id,
        e.enr_club_name AS school_name,
        e.hm_name AS contact_name,
        e.hm_mobile AS contact_no,
        COUNT(CASE WHEN c.submit_ces = 1 THEN 1 END) AS total_activities
      FROM tbl_enrclub_name e
      INNER JOIN tbl_enr_custm_image_vdo_up c ON c.user_id = e.enruser_name
      INNER JOIN tbl_enr_customizepgrm cp ON cp.eng_custom_id = c.img_vdo_id
      WHERE c.submit_ces = 1
    `;

    if (district && district !== "0") {
      sql += " AND e.district = ? ";
      params.push(district);
    }

    if (activity && activity !== "0") {
      sql += " AND cp.activity_id = ? ";
      params.push(activity);
    }

    if (fy_start && fy_end) {
      sql += " AND cp.from_date BETWEEN ? AND ? ";
      params.push(fy_start, fy_end);
    }

    sql += `
      GROUP BY e.enrclub_id, e.enr_club_name, e.hm_name, e.hm_mobile
      ORDER BY e.enr_club_name ASC
    `;

    db.query(sql, params, (err, results) => {
      if (err) return res.status(500).json({ error: err.sqlMessage });
      return res.json(results);
    });
    return; // early return because we already executed for 'submitted'
  }

  sql += `
    ORDER BY e.enr_club_name ASC
  `;

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ error: err.sqlMessage });
    res.json(results);
  });
});

app.get("/api/fund-allocation-analysis", (req, res) => {
  const { fy_start, fy_end } = req.query;

  if (!fy_start || !fy_end) {
    return res.status(400).json({ error: "Missing fy_start or fy_end" });
  }

  // 1️⃣ GLOBAL All School
  const allSchoolSql = `
    SELECT 
      SUM(CAST(REPLACE(allocation_amount, ',', '') AS DECIMAL(18,2))) AS all_school_amount
    FROM tbl_enr_fundallocation
    WHERE 
      school_status = 1 AND sch_status_updt = 1
      AND allocation_date BETWEEN ? AND ?
  `;

  db.query(allSchoolSql, [fy_start, fy_end], (err1, allSchoolRes) => {
    if (err1) return res.status(500).json({ error: err1.sqlMessage });

    const allSchoolAmount = Number(allSchoolRes[0].all_school_amount || 0);

    // 2️⃣ SELECTED SCHOOL (District-wise LEFT JOIN)
    const selectedSchoolSql = `
      SELECT 
        d.dist_id,
        d.district AS district_name,

        COALESCE(SUM(
          CASE 
            WHEN fa.school_status = 2 
              AND fa.sch_status_updt = 1
              AND a.status = 1
            THEN CAST(REPLACE(fa.allocation_amount, ',', '') AS DECIMAL(18,2))
            ELSE 0 
          END
        ), 0) AS selected_school_amount

      FROM tbl_district d
      LEFT JOIN tbl_enr_allocate a ON d.dist_id = a.dist_id
      LEFT JOIN tbl_enr_fundallocation fa 
        ON a.fundallocation_id = fa.fundallocation_id
        AND fa.allocation_date BETWEEN ? AND ?

      GROUP BY d.dist_id, d.district
      ORDER BY d.district ASC
    `;

    db.query(selectedSchoolSql, [fy_start, fy_end], (err2, selectedRows) => {
      if (err2) return res.status(500).json({ error: err2.sqlMessage });

      const final = selectedRows.map((r) => ({
        dist_id: r.dist_id,
        district_name: r.district_name,
        all_school_amount: allSchoolAmount,   // SAME FOR ALL
        selected_school_amount: r.selected_school_amount || 0
      }));

      res.json(final);
    });
  });
});


app.get("/api/fund-utilisation-details", (req, res) => {
  const { district, fy_start, fy_end } = req.query;

  if (!district) return res.status(400).json({ error: "Missing district" });
  if (!fy_start || !fy_end)
    return res.status(400).json({ error: "Missing FY dates" });

  // Summary
  const summarySql = `
    SELECT
      COALESCE(SUM(CAST(REPLACE(fa.allocation_amount, ',', '') AS DECIMAL(18,2))),0) AS total_allocation,
      COALESCE(SUM(CASE WHEN fa.sch_status_updt = 1 THEN CAST(REPLACE(fa.allocation_amount, ',', '') AS DECIMAL(18,2)) ELSE 0 END),0) AS total_utilisation
    FROM tbl_enr_allocate a
    INNER JOIN tbl_enr_fundallocation fa ON a.fundallocation_id = fa.fundallocation_id
    WHERE a.dist_id = ? AND fa.allocation_date BETWEEN ? AND ?
  `;

  // School wise
  const schoolSql = `
    SELECT
      c.enrclub_id,
      c.enr_club_name AS school_name,
      COALESCE(SUM(CAST(REPLACE(fa.allocation_amount, ',', '') AS DECIMAL(18,2))),0) AS allocation_amount,
      COALESCE(SUM(CASE WHEN fa.sch_status_updt = 1 THEN CAST(REPLACE(fa.allocation_amount, ',', '') AS DECIMAL(18,2)) ELSE 0 END),0) AS utilised_amount
    FROM tbl_enr_allocate a
    INNER JOIN tbl_enr_fundallocation fa ON a.fundallocation_id = fa.fundallocation_id
    INNER JOIN tbl_enrclub_name c ON a.enrclub_id = c.enrclub_id
    WHERE a.dist_id = ? AND fa.allocation_date BETWEEN ? AND ?
    GROUP BY c.enrclub_id, c.enr_club_name
    ORDER BY c.enr_club_name ASC
  `;

  db.query(summarySql, [district, fy_start, fy_end], (err, sumRes) => {
    if (err) return res.status(500).json({ error: err.sqlMessage });

    db.query(schoolSql, [district, fy_start, fy_end], (err2, schoolRes) => {
      if (err2) return res.status(500).json({ error: err2.sqlMessage });

      const total_allocation = Number(sumRes[0].total_allocation || 0);
      const total_utilisation = Number(sumRes[0].total_utilisation || 0);

      const schools = schoolRes.map((s) => ({
        id: s.enrclub_id,
        school: s.school_name,
        allocation: Number(s.allocation_amount || 0),
        utilisation: Number(s.utilised_amount || 0),
      }));

      res.json({
        district_name: schoolRes[0]?.district_name,
        total_allocation,
        total_utilisation,
        balance: total_allocation - total_utilisation,
        schools,
      });
    });
  });
});



// -------------------- Energy Club Status Route --------------------

// app.get("/api/energy-club-status", (req, res) => {
//   const sql = `
//     SELECT 
//         c.enrclub_id,
//         c.enr_club_name,
//         COUNT(DISTINCT a.activity_id) AS total_assigned,
//         COUNT(DISTINCT s.act_id) AS total_submitted,
//         (COUNT(DISTINCT a.activity_id) - COUNT(DISTINCT s.act_id)) AS pending
//     FROM tbl_enrclub_name c
//     LEFT JOIN tbl_activitysubmission s ON c.enrclub_id = s.enrclub_id
//     LEFT JOIN tbl_enr_assignactivity a 
//            ON s.act_id = a.activity_id
//           AND s.subact_id = a.enr_assignactivity_id
//     GROUP BY c.enrclub_id, c.enr_club_name
//     ORDER BY c.enr_club_name;
//   `;

//   db.query(sql, (err, results) => {
//     if (err) {
//       console.error("Error fetching Energy Club status:", err);
//       return res.status(500).json({ error: "Server error" });
//     }
//     res.json(results);
//   });
// });

app.get("/api/energy-club-status", (req, res) => {
  const { club_id } = req.query;

  let sql = `
    SELECT 
        c.enrclub_id,
        c.enr_club_name,
        COUNT(DISTINCT a.activity_id) AS total_assigned,
        COUNT(DISTINCT s.act_id) AS total_submitted,
        (COUNT(DISTINCT a.activity_id) - COUNT(DISTINCT s.act_id)) AS pending
    FROM tbl_enrclub_name c
    LEFT JOIN tbl_activitysubmission s ON c.enrclub_id = s.enrclub_id
    LEFT JOIN tbl_enr_assignactivity a 
           ON s.act_id = a.activity_id
          AND s.subact_id = a.enr_assignactivity_id
    WHERE 1
  `;

  const params = [];

  if (club_id) {
    sql += " AND c.enrclub_id = ?";
    params.push(club_id);
  }

  sql += " GROUP BY c.enrclub_id, c.enr_club_name ORDER BY c.enr_club_name";

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error("Error fetching Energy Club status:", err);
      return res.status(500).json({ error: "Server error" });
    }
    res.json(results);
  });
});


app.get("/api/energy-club-monthly", (req, res) => {
  const { club_id } = req.query;
  const clubId = club_id || "ENERGYCLUB-0027";

  const sql = `
    SELECT 
      MONTH(submission_date) AS month_num,
      DATE_FORMAT(submission_date, '%b') AS month_name,
      COUNT(*) AS total_submissions
    FROM tbl_activitysubmission
    WHERE enruser_name = ?
    GROUP BY MONTH(submission_date)
    ORDER BY MONTH(submission_date)
  `;

  db.query(sql, [clubId], (err, results) => {
    if (err) {
      console.error("❌ SQL Error (monthly):", err);
      return res.status(500).json({ error: "Database error" });
    }

    if (!results.length) {
      console.log("ℹ️ No monthly records found for club:", clubId);
    }

    const formatted = results.map(row => ({
      month: row.month_name,
      submissions: row.total_submissions,
    }));

    res.json(formatted);
  });
});


app.get("/api/monthly-school-submissions", (req, res) => {
  const { fy } = req.query; // optional filter for year (e.g. 2025)
  const year = fy || new Date().getFullYear();

  const sql = `
    SELECT 
      MONTH(s.submission_date) AS month_num,
      DATE_FORMAT(s.submission_date, '%b') AS month_name,
      COUNT(DISTINCT s.enrclub_id) AS submitted_schools,
      (SELECT COUNT(*) FROM tbl_enrclub_name) AS total_schools
    FROM tbl_activitysubmission s
    WHERE YEAR(s.submission_date) = ?
    GROUP BY MONTH(s.submission_date)
    ORDER BY MONTH(s.submission_date)
  `;

  db.query(sql, [year], (err, results) => {
    if (err) {
      console.error("❌ SQL Error:", err);
      return res.status(500).json({ error: "Database error" });
    }

    const formatted = results.map(row => ({
      month: row.month_name,
      submitted: row.submitted_schools,
      total: row.total_schools,
    }));

    res.json(formatted);
  });
});

// -------------------- Monthly School Submissions (FY Wise + School/Activity Filter) --------------------
// -------------------- Monthly School Submissions (FY Wise + School/Activity Filter) --------------------
app.get("/api/monthly-school-submissions-fy", (req, res) => {
  const { fy_start, fy_end, club_id, activity_id } = req.query;

  const startDate = fy_start || "2025-04-01";
  const endDate = fy_end || "2026-03-31";

  // Case A: specific club selected -> show that club's monthly submitted activities (optionally by activity)
  if (club_id) {
    let sql = `
      SELECT 
        DATE_FORMAT(s.submission_date, '%Y-%m') AS monthyear,
        DATE_FORMAT(s.submission_date, '%b') AS month_name,
        COUNT(DISTINCT s.actsub_id) AS submitted_activities,
        a.activity AS activity_name
      FROM tbl_activitysubmission s
      LEFT JOIN tbl_activity a ON s.act_id = a.activities_id
      WHERE s.submission_date BETWEEN ? AND ?
        AND s.enrclub_id = ?
    `;
    const params = [startDate, endDate, club_id];

    if (activity_id) {
      sql += " AND s.act_id = ?";
      params.push(activity_id);
    }

    sql += `
      GROUP BY monthyear, a.activity
      ORDER BY monthyear ASC;
    `;

    db.query(sql, params, (err, results) => {
      if (err) {
        console.error("❌ SQL Error (School Specific):", err);
        return res.status(500).json({ error: "Database error" });
      }

      const formatted = results.map((r) => ({
        month: r.month_name,
        "Submitted Activities": r.submitted_activities,
        Activity: r.activity_name || "All Activities",
      }));

      return res.json(formatted);
    });

    return;
  }

  // Case B: all schools -> count distinct schools that submitted per month
  // If activity_id provided, count only schools that submitted that activity in the month
  let sqlAll = `
    SELECT
      DATE_FORMAT(s.submission_date, '%Y-%m') AS monthyear,
      DATE_FORMAT(s.submission_date, '%b') AS month_name,
      COUNT(DISTINCT s.enrclub_id) AS submitted_schools,
      (SELECT COUNT(*) FROM tbl_enrclub_name) AS total_schools
    FROM tbl_activitysubmission s
    WHERE s.submission_date BETWEEN ? AND ?
  `;
  const paramsAll = [startDate, endDate];

  if (activity_id) {
    sqlAll += " AND s.act_id = ?";
    paramsAll.push(activity_id);
  }

  sqlAll += `
    GROUP BY monthyear
    ORDER BY monthyear ASC;
  `;

  db.query(sqlAll, paramsAll, (err, results) => {
    if (err) {
      console.error("❌ SQL Error (All Schools):", err);
      return res.status(500).json({ error: "Database error" });
    }

    const formatted = results.map((r) => ({
      month: r.month_name,
      total_schools: r.total_schools,
      submitted_schools: r.submitted_schools,
    }));

    return res.json(formatted);
  });
});





// -------------------- Energy Club total Pending Route --------------------
app.get("/api/energy-club-pending-total", (req, res) => {
  const sql = `
    SELECT 
        c.enrclub_id,
        c.enr_club_name,
        COUNT(DISTINCT a.activity_id) AS total_assigned,
        COUNT(DISTINCT s.act_id) AS total_submitted,
        (COUNT(DISTINCT a.activity_id) - COUNT(DISTINCT s.act_id)) AS pending
    FROM tbl_enrclub_name c
    LEFT JOIN tbl_activitysubmission s ON c.enrclub_id = s.enrclub_id
    LEFT JOIN tbl_enr_assignactivity a 
           ON s.act_id = a.activity_id
          AND s.subact_id = a.enr_assignactivity_id
    GROUP BY c.enrclub_id, c.enr_club_name
    ORDER BY c.enr_club_name;
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("❌ Error fetching pending data:", err);
      return res.status(500).json({ error: "Server error" });
    }

    // Send all clubs regardless of pending
    const chartData = results.map(row => ({
      name: row.enr_club_name,
      total_assigned: row.total_assigned,
      total_submitted: row.total_submitted,
      pending: row.pending
    }));

    res.json(chartData);
  });
});


// -------------------- Pending by Activity Route --------------------
app.get("/api/eng-pending-byname", (req, res) => {
  const sql = `
    SELECT 
        act.activity AS activity_name,
        c.enrclub_id,
        c.enr_club_name,
        COUNT(DISTINCT a.activity_id) AS total_assigned,
        COUNT(DISTINCT s.act_id) AS total_submitted,
        (COUNT(DISTINCT a.activity_id) - COUNT(DISTINCT s.act_id)) AS pending
    FROM tbl_enrclub_name c
    LEFT JOIN tbl_activitysubmission s 
        ON c.enrclub_id = s.enrclub_id
    LEFT JOIN tbl_enr_assignactivity a 
        ON s.act_id = a.activity_id
       AND s.subact_id = a.enr_assignactivity_id
    LEFT JOIN tbl_activity act 
        ON a.activity_id = act.activities_id
       AND act.applicable_for = 2
    GROUP BY act.activity, c.enrclub_id, c.enr_club_name
    ORDER BY act.activity, c.enr_club_name;
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("❌ Error fetching pending by activity:", err);
      return res.status(500).json({ error: "Server error" });
    }

    // ✅ Transform data: group by activity, split into own vs others
    const grouped = {};

    results.forEach(row => {
      if (!grouped[row.activity_name]) {
        grouped[row.activity_name] = {
          activity_name: row.activity_name,
          total_assigned: 0,
          total_submitted: 0,
          own_pending: 0,
          other_pending: 0,
        };
      }

      // Update totals
      grouped[row.activity_name].total_assigned += row.total_assigned;
      grouped[row.activity_name].total_submitted += row.total_submitted;

      // Here you decide "own" club vs "others" → replace `1` with logged-in user’s club_id
      const ownClubId = 1; // 🔴 TODO: replace with req.user.enrclub_id if you have login
      if (row.enrclub_id === ownClubId) {
        grouped[row.activity_name].own_pending += row.pending;
      } else {
        grouped[row.activity_name].other_pending += row.pending;
      }
    });

    res.json(Object.values(grouped));
  });
});

// -------------------- Energy Club Status (Financial Year Wise) --------------------
// -------------------- Energy Club Status (Financial Year + Activity/SubActivity Wise) --------------------
app.get("/api/energy-club-status-financialyear", (req, res) => {
  const { club_id, fy_start, fy_end, activity_id, subActivity_id } = req.query;

  if (!club_id) {
    return res.status(400).json({ error: "Missing required parameter: club_id" });
  }

  const startDate = fy_start || "2025-04-01";
  const endDate = fy_end || "2026-03-31";

  console.log("➡️ Fetching FY Data:", { club_id, startDate, endDate, activity_id, subActivity_id });

  let sql = `
    SELECT 
      a.activity,
      s.sub_activity_name,
      DATE_FORMAT(es.submission_date, '%Y-%m') AS monthyear,
      COUNT(DISTINCT es.actsub_id) AS total_submitted,
      (
        SELECT COUNT(DISTINCT e.subActivity_id)
        FROM tbl_enr_assignactivity e
        LEFT JOIN tbl_sub_activity sa ON e.subActivity_id = sa.sub_activity_id
        WHERE e.activity_id = a.activities_id
      ) AS total_assigned
    FROM tbl_activitysubmission es
    LEFT JOIN tbl_activity a ON es.act_id = a.activities_id
    LEFT JOIN tbl_sub_activity s ON es.subact_id = s.sub_activity_id
    WHERE es.enrclub_id = ?
      AND es.submission_date BETWEEN ? AND ?
  `;

  const params = [club_id, startDate, endDate];

  if (activity_id) {
    sql += " AND es.act_id = ?";
    params.push(activity_id);
  }

  if (subActivity_id) {
    sql += " AND es.subact_id = ?";
    params.push(subActivity_id);
  }

  sql += `
    GROUP BY a.activity, s.sub_activity_name, monthyear
    ORDER BY monthyear ASC, a.activity;
  `;

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error("❌ SQL Error (Activity/SubActivity):", err);
      return res.status(500).json({ error: "Database error" });
    }

    if (!results.length) {
      console.log(`ℹ️ No records found for Club ${club_id} in FY ${startDate}–${endDate}`);
    }

    res.json(results);
  });
});



// Fetch all activities
app.get("/api/activities", (req, res) => {
  const sql = "SELECT activities_id, activity FROM tbl_activity ORDER BY activity ASC";
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: "Database error" });
    res.json(results);
  });
});

// Fetch subactivities for a given activity
app.get("/api/subactivities", (req, res) => {
  const { activity_id } = req.query;
  if (!activity_id) return res.json([]);
  const sql = "SELECT sub_activity_id, sub_activity_name FROM tbl_sub_activity WHERE activity_id = ?";
  db.query(sql, [activity_id], (err, results) => {
    if (err) return res.status(500).json({ error: "Database error" });
    res.json(results);
  });
});

// Lazy search school list
app.get("/api/energy-club-list", (req, res) => {
  const { search } = req.query;
  let sql = `
    SELECT enrclub_id, enr_club_name
    FROM tbl_enrclub_name
    WHERE 1
  `;
  const params = [];

  if (search && search.trim() !== "") {
    sql += " AND enr_club_name LIKE ?";
    params.push(`%${search}%`);
  }

  sql += " ORDER BY enr_club_name ASC LIMIT 50";

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error("❌ Error fetching clubs:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});




// -------------------- Funds Allocation vs Utilization --------------------
app.get("/api/energy-club-funds-status", (req, res) => {
  const sql = `
    SELECT
        c.enrclub_id,
        c.enr_club_name,
        COUNT(DISTINCT uc.fundallocation_id) AS total_fund_allocations_with_uploads,
        COUNT(DISTINCT uc.uploaduc_id) AS total_fund_uploads
    FROM tbl_enrclub_name c
    LEFT JOIN tbl_enr_uploaduc uc
      ON uc.enrclub_id = c.enruser_name
    LEFT JOIN tbl_enr_fundallocation fa
      ON fa.fundallocation_id = uc.fundallocation_id
      AND fa.allocation_amount > 0
    GROUP BY
        c.enrclub_id, c.enr_club_name
    ORDER BY
        c.enr_club_name;
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("❌ Error fetching fund status:", err);
      return res.status(500).json({ error: "Server error" });
    }

    const chartData = results.map(row => ({
      id: row.enrclub_id,
      name: row.enr_club_name,
      allocations: row.total_fund_allocations_with_uploads || 0,
      uploads: row.total_fund_uploads || 0,
    }));

    res.json(chartData);
  });
});


//user profie status
app.get("/api/user-activity-status", (req, res) => {
  const { username } = req.query;

  let sql = `
    SELECT 
        c.enrclub_id,
        c.enr_club_name,
        c.enruser_name,
        COUNT(DISTINCT a.activity_id) AS total_assigned,
        COUNT(DISTINCT s.act_id) AS total_submitted,
        (COUNT(DISTINCT a.activity_id) - COUNT(DISTINCT s.act_id)) AS pending
    FROM tbl_enrclub_name c
    LEFT JOIN tbl_activitysubmission s 
           ON c.enrclub_id = s.enrclub_id
    LEFT JOIN tbl_enr_assignactivity a
           ON a.activity_id = s.act_id
          AND a.enr_assignactivity_id = s.subact_id
  `;

  const params = [];

  // Filter by username if provided
  if (username) {
    sql += " WHERE c.enruser_name = ? ";
    params.push(username);
  }

  sql += `
    GROUP BY c.enrclub_id, c.enr_club_name, c.enruser_name
    ORDER BY c.enruser_name
  `;

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error("SQL error:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});





// -------------------- Start Server --------------------
// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => {
//   console.log(`✅ Backend running at http://localhost:${PORT}`);
// });
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Backend running at http://0.0.0.0:${PORT}`);
});
