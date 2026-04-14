/**
 * VO / RVO / ORCA algorithm implementations.
 *
 * Each algorithm computes "cones" (or half-planes) in velocity space
 * that represent forbidden velocities, then selects the best valid velocity.
 */

const Algorithms = (() => {

    // ── VO Cone computation ────────────────────────────────────────────

    /**
     * Compute a Velocity Obstacle cone in *absolute* velocity space for agentA
     * induced by agentB.
     *
     * Returns { apex, leftAngle, rightAngle, centerAngle, halfAngle,
     *           truncCenter, truncRadius }
     * where apex is in absolute velocity space for VO, or shifted for RVO.
     */
    function computeVOCone(agentA, agentB, timeHorizon) {
        const relPos = agentB.position.sub(agentA.position);
        const dist = relPos.length();
        const combinedRadius = agentA.radius + agentB.radius;

        if (dist < combinedRadius) {
            // Already overlapping — push apart
            return {
                apex: agentB.velocity.clone(),
                centerAngle: relPos.angle(),
                halfAngle: Math.PI, // entire half-space
                leftAngle: relPos.angle() - Math.PI,
                rightAngle: relPos.angle() + Math.PI,
                truncCenter: null,
                truncRadius: 0,
                overlapping: true
            };
        }

        const centerAngle = relPos.angle();
        const halfAngle = Math.asin(Math.min(combinedRadius / dist, 1));

        // Apex of VO in absolute velocity space is at vB
        const apex = agentB.velocity.clone();

        // Truncation circle: in relative velocity space at relPos/τ, radius cR/τ
        // In absolute space: shift by vB
        const truncCenter = relPos.scale(1 / timeHorizon).add(agentB.velocity);
        const truncRadius = combinedRadius / timeHorizon;

        return {
            apex,
            centerAngle,
            halfAngle,
            leftAngle: centerAngle - halfAngle,
            rightAngle: centerAngle + halfAngle,
            truncCenter,
            truncRadius,
            overlapping: false
        };
    }

    /**
     * Compute an RVO cone — same shape as VO but apex shifted to (vA+vB)/2.
     */
    function computeRVOCone(agentA, agentB, timeHorizon) {
        const cone = computeVOCone(agentA, agentB, timeHorizon);

        // RVO shifts apex from vB to (vA+vB)/2
        const rvoApex = agentA.velocity.add(agentB.velocity).scale(0.5);
        const shift = rvoApex.sub(cone.apex);
        cone.apex = rvoApex;
        if (cone.truncCenter) {
            cone.truncCenter = cone.truncCenter.add(shift);
        }
        return cone;
    }

    // ── Point-in-cone test ─────────────────────────────────────────────

    function isInsideCone(vel, cone) {
        if (cone.overlapping) {
            // half-space: everything on the collision side
            const relPos = Vec2.fromAngle(cone.centerAngle);
            return vel.sub(cone.apex).dot(relPos) > 0;
        }

        const rel = vel.sub(cone.apex);
        const relAngle = rel.angle();
        let diff = relAngle - cone.centerAngle;
        // Normalize to [-π, π]
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;

        if (Math.abs(diff) >= cone.halfAngle) return false;

        // Check truncation: must be past the truncation circle
        if (cone.truncCenter) {
            const distFromApex = rel.length();
            const truncDist = cone.truncCenter.sub(cone.apex).length();
            // The point must be farther than truncation distance along center direction
            // More precisely, check if it's beyond the truncation disk
            const projOnCenter = rel.dot(Vec2.fromAngle(cone.centerAngle));
            if (projOnCenter < truncDist - cone.truncRadius * 0.5) return false;
        }

        return true;
    }

    // ── Velocity selection ─────────────────────────────────────────────

    /**
     * Project a point onto the closest edge of a cone and return candidates.
     */
    function projectOntoConeEdges(vel, cone) {
        const candidates = [];
        if (cone.overlapping) return candidates;

        // Left edge direction
        const leftDir = Vec2.fromAngle(cone.leftAngle);
        // Right edge direction
        const rightDir = Vec2.fromAngle(cone.rightAngle);

        // Project onto left edge ray from apex
        const relVel = vel.sub(cone.apex);
        const projLeft = relVel.dot(leftDir);
        if (projLeft > 0) {
            candidates.push({
                point: cone.apex.add(leftDir.scale(projLeft)),
                dist: vel.distTo(cone.apex.add(leftDir.scale(projLeft)))
            });
        }

        // Project onto right edge ray from apex
        const projRight = relVel.dot(rightDir);
        if (projRight > 0) {
            candidates.push({
                point: cone.apex.add(rightDir.scale(projRight)),
                dist: vel.distTo(cone.apex.add(rightDir.scale(projRight)))
            });
        }

        // Project onto truncation circle
        if (cone.truncCenter) {
            const toVel = vel.sub(cone.truncCenter);
            const len = toVel.length();
            if (len > 1e-6) {
                const onCircle = cone.truncCenter.add(toVel.scale(cone.truncRadius / len));
                // Check the point is within the cone's angular range
                const relOnCircle = onCircle.sub(cone.apex);
                let angle = relOnCircle.angle() - cone.centerAngle;
                while (angle > Math.PI) angle -= 2 * Math.PI;
                while (angle < -Math.PI) angle += 2 * Math.PI;
                if (Math.abs(angle) <= cone.halfAngle) {
                    candidates.push({
                        point: onCircle,
                        dist: vel.distTo(onCircle)
                    });
                }
            }
        }

        return candidates;
    }

    /**
     * Select the best velocity outside all cones, closest to preferredVel.
     * Uses geometric projection + sampling fallback.
     */
    function selectVelocity(cones, preferredVel, maxSpeed) {
        // Clamp preferred velocity to max speed
        if (preferredVel.length() > maxSpeed) {
            preferredVel = preferredVel.truncate(maxSpeed);
        }

        // Check if preferred velocity is already valid
        let inAnyCone = false;
        for (const cone of cones) {
            if (isInsideCone(preferredVel, cone)) {
                inAnyCone = true;
                break;
            }
        }
        if (!inAnyCone) return preferredVel;

        // Collect candidates from cone edge projections
        let bestCandidate = null;
        let bestDist = Infinity;

        for (const cone of cones) {
            const projections = projectOntoConeEdges(preferredVel, cone);
            for (const proj of projections) {
                // Check speed limit
                if (proj.point.length() > maxSpeed + 1e-6) {
                    // Clamp to max speed circle
                    proj.point = proj.point.truncate(maxSpeed);
                    proj.dist = preferredVel.distTo(proj.point);
                }

                // Check if outside all cones
                let valid = true;
                for (const otherCone of cones) {
                    if (isInsideCone(proj.point, otherCone)) {
                        valid = false;
                        break;
                    }
                }

                if (valid && proj.dist < bestDist) {
                    bestDist = proj.dist;
                    bestCandidate = proj.point;
                }
            }
        }

        // Also try points on the max speed circle
        const numSamples = 48;
        for (let i = 0; i < numSamples; i++) {
            const angle = (2 * Math.PI * i) / numSamples;
            const sample = Vec2.fromAngle(angle, maxSpeed);
            let valid = true;
            for (const cone of cones) {
                if (isInsideCone(sample, cone)) {
                    valid = false;
                    break;
                }
            }
            if (valid) {
                const d = preferredVel.distTo(sample);
                if (d < bestDist) {
                    bestDist = d;
                    bestCandidate = sample;
                }
            }
        }

        // Sampling fallback: try random velocities within the speed disk
        if (!bestCandidate) {
            for (let ring = 1; ring <= 5; ring++) {
                const speed = maxSpeed * ring / 5;
                for (let i = 0; i < 36; i++) {
                    const angle = (2 * Math.PI * i) / 36;
                    const sample = Vec2.fromAngle(angle, speed);
                    let valid = true;
                    for (const cone of cones) {
                        if (isInsideCone(sample, cone)) {
                            valid = false;
                            break;
                        }
                    }
                    if (valid) {
                        const d = preferredVel.distTo(sample);
                        if (d < bestDist) {
                            bestDist = d;
                            bestCandidate = sample;
                        }
                    }
                }
            }
        }

        // Last resort: zero velocity or tiny velocity away
        if (!bestCandidate) {
            bestCandidate = Vec2.zero();
        }

        return bestCandidate;
    }

    // ── ORCA (half-plane) computation ──────────────────────────────────

    /**
     * Compute an ORCA half-plane for agentA induced by agentB.
     * Returns { point, direction } defining a line; valid velocities
     * are on the LEFT side of the direction vector.
     */
    function computeORCALine(agentA, agentB, timeHorizon) {
        let relPos = agentB.position.sub(agentA.position);
        const relVel = agentA.velocity.sub(agentB.velocity);
        const combinedRadius = agentA.radius + agentB.radius;
        const combinedRadiusSq = combinedRadius * combinedRadius;
        let constraintKind = 'cone';

        // ── Symmetry-breaking for collinear approach ──────────────
        // When agents approach nearly head-on (relVel ∥ relPos), the ORCA
        // constraint only decelerates without lateral movement. We perturb
        // relPos so each agent "sees" the other slightly off-axis, causing
        // them to swerve in opposite directions.
        let dist = relPos.length();
        if (dist > 1e-6) {
            const relVelLen = relVel.length();
            if (relVelLen > 0.5 && relVel.dot(relPos) > 0) {
                const sinAngle = Math.abs(relPos.cross(relVel)) / (dist * relVelLen);
                if (sinAngle < 0.06) {
                    // Canonical perpendicular: always based on lower→higher ID
                    const canonical = agentA.id < agentB.id ? relPos : relPos.negate();
                    const perp = new Vec2(-canonical.y, canonical.x).normalize();
                    const sign = agentA.id < agentB.id ? 1 : -1;
                    relPos = relPos.add(perp.scale(sign * combinedRadius * 0.5));
                    dist = relPos.length();
                }
            }
        }

        const distSq = dist * dist;
        const invTimeHorizon = 1.0 / timeHorizon;
        let u, direction;

        if (distSq > combinedRadiusSq) {
            // No collision — project on cone or truncation circle
            const w = relVel.sub(relPos.scale(invTimeHorizon));
            const wLenSq = w.lengthSq();
            const dotProduct1 = w.dot(relPos);

            if (dotProduct1 < 0 && dotProduct1 * dotProduct1 > combinedRadiusSq * wLenSq) {
                // Project on truncation circle
                const wLen = Math.sqrt(wLenSq);
                const unitW = w.scale(1 / wLen);
                direction = new Vec2(unitW.y, -unitW.x);
                u = unitW.scale(combinedRadius * invTimeHorizon - wLen);
                constraintKind = 'truncation';
            } else {
                // Project on cone edge
                const leg = Math.sqrt(Math.max(0, distSq - combinedRadiusSq));
                if (relPos.cross(w) > 0) {
                    // Left leg
                    direction = new Vec2(
                        relPos.x * leg - relPos.y * combinedRadius,
                        relPos.x * combinedRadius + relPos.y * leg
                    ).scale(1 / distSq);
                } else {
                    // Right leg
                    direction = new Vec2(
                        relPos.x * leg + relPos.y * combinedRadius,
                        -relPos.x * combinedRadius + relPos.y * leg
                    ).scale(-1 / distSq);
                }
                const dotProduct2 = relVel.dot(direction);
                u = direction.scale(dotProduct2).sub(relVel);
                constraintKind = 'cone';
            }
        } else {
            // Already colliding — push apart immediately
            const invTimeStep = 60; // assume 60fps
            const w = relVel.sub(relPos.scale(invTimeStep));
            const wLen = w.length();
            if (wLen < 1e-6) {
                // Zero relative velocity while overlapping — use perpendicular
                const perp = relPos.normalize().perp();
                direction = perp;
                u = new Vec2(0, 0);
            } else {
                const unitW = w.scale(1 / wLen);
                direction = new Vec2(unitW.y, -unitW.x);
                u = unitW.scale(combinedRadius * invTimeStep - wLen);
            }
            constraintKind = 'collision';
        }

        const point = agentA.velocity.add(u.scale(0.5));

        return {
            point,
            direction,
            normal: direction.perp(),
            u,
            responsibilityShift: u.scale(0.5),
            sourceVelocity: agentA.velocity.clone(),
            relativePosition: relPos,
            relativeVelocity: relVel,
            combinedRadius,
            distance: dist,
            timeHorizon,
            constraintKind
        };
    }

    /**
     * ORCA velocity selection using 2D linear programming.
     */
    function selectVelocityORCA(lines, preferredVel, maxSpeed) {
        let result = preferredVel.clone();

        // Try to satisfy each constraint incrementally
        for (let i = 0; i < lines.length; i++) {
            // Check if current result satisfies line i
            if (det(lines[i].direction, lines[i].point.sub(result)) > 0) {
                // Does not satisfy — project onto line i
                const projected = projectOnLine(lines[i], result, maxSpeed);
                if (projected === null) {
                    // Infeasible — find best partial solution
                    result = lp2Fallback(lines, i, maxSpeed, preferredVel);
                    break;
                }
                result = projected;

                // Re-check all previous lines
                let feasible = true;
                for (let j = 0; j < i; j++) {
                    if (det(lines[j].direction, lines[j].point.sub(result)) > 0) {
                        // Try to find intersection
                        const intersected = intersectLines(lines[j], lines[i], maxSpeed);
                        if (intersected === null) {
                            result = lp2Fallback(lines, i, maxSpeed, preferredVel);
                            feasible = false;
                            break;
                        }
                        result = intersected;
                    }
                }
                if (!feasible) break;
            }
        }

        // Clamp to max speed
        if (result.length() > maxSpeed) {
            result = result.truncate(maxSpeed);
        }
        return result;
    }

    function det(a, b) { return a.x * b.y - a.y * b.x; }

    function projectOnLine(line, optVel, maxSpeed) {
        const dotProduct = line.point.dot(line.direction);
        const discriminant = dotProduct * dotProduct + maxSpeed * maxSpeed - line.point.lengthSq();
        if (discriminant < 0) return null;
        const sqrtD = Math.sqrt(discriminant);
        let tLeft = -dotProduct - sqrtD;
        let tRight = -dotProduct + sqrtD;
        const t = line.direction.dot(optVel.sub(line.point));
        const clamped = Math.max(tLeft, Math.min(tRight, t));
        return line.point.add(line.direction.scale(clamped));
    }

    function intersectLines(line1, line2, maxSpeed) {
        const d = det(line1.direction, line2.direction);
        if (Math.abs(d) < 1e-6) return null;
        const t = det(line2.direction, line1.point.sub(line2.point)) / d;
        const point = line1.point.add(line1.direction.scale(t));
        if (point.length() > maxSpeed + 1e-3) return null;
        return point;
    }

    function lp2Fallback(lines, failedLine, maxSpeed, preferredVel) {
        // Find best direction on the max speed circle
        let bestDist = Infinity;
        let best = preferredVel.truncate(maxSpeed);

        const n = 64;
        for (let i = 0; i < n; i++) {
            const angle = (2 * Math.PI * i) / n;
            const candidate = Vec2.fromAngle(angle, maxSpeed);
            let valid = true;
            for (let j = 0; j <= failedLine && j < lines.length; j++) {
                if (det(lines[j].direction, lines[j].point.sub(candidate)) > 0) {
                    valid = false;
                    break;
                }
            }
            if (valid) {
                const d = preferredVel.distTo(candidate);
                if (d < bestDist) {
                    bestDist = d;
                    best = candidate;
                }
            }
        }
        return best;
    }

    /**
     * Signed distance from a velocity to the valid side of an ORCA line.
     * Negative means the velocity violates the half-plane constraint.
     */
    function signedDistanceToORCALine(line, velocity) {
        return line.direction.perp().dot(velocity.sub(line.point));
    }

    // ── Public API ─────────────────────────────────────────────────────

    return {
        computeVOCone,
        computeRVOCone,
        computeORCALine,
        isInsideCone,
        selectVelocity,
        selectVelocityORCA,
        projectOntoConeEdges,
        signedDistanceToORCALine
    };

})();
