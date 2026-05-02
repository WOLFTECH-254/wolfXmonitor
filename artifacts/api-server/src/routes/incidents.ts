import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.get("/incidents", requireAuth, async (req, res) => {
  const userId = req.session.userId!;

  const result = await pool.query(
    `
    WITH ordered_pings AS (
      SELECT
        p.id,
        p.monitor_id,
        p.status,
        p.status_code,
        p.error,
        p.created_at,
        LAG(p.status) OVER (PARTITION BY p.monitor_id ORDER BY p.created_at) AS prev_status
      FROM pings p
      JOIN monitors m ON m.id = p.monitor_id
      WHERE m.user_id = $1
    ),
    incident_starts AS (
      SELECT id, monitor_id, status_code, error, created_at
      FROM ordered_pings
      WHERE status = 'down' AND (prev_status IS NULL OR prev_status = 'up')
    )
    SELECT
      s.id,
      s.monitor_id,
      s.status_code,
      s.error,
      s.created_at AS started_at,
      MIN(p.created_at) AS resolved_at,
      m.name AS monitor_name,
      m.url AS monitor_url
    FROM incident_starts s
    LEFT JOIN pings p
      ON p.monitor_id = s.monitor_id
      AND p.status = 'up'
      AND p.created_at > s.created_at
    JOIN monitors m ON m.id = s.monitor_id
    GROUP BY s.id, s.monitor_id, s.status_code, s.error, s.created_at, m.name, m.url
    ORDER BY s.created_at DESC
    LIMIT 200
    `,
    [userId]
  );

  res.json(result.rows);
});

export default router;
