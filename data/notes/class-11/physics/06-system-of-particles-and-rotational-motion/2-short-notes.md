---
title: "Rotational Motion: Short Notes"
type: short_notes
chapter: c11.physics.system-of-particles-and-rotational-motion
order: 2
---

## 1. Rigid bodies and their motion

- A **rigid body** is one whose shape and size do not change: the distance between any two of its particles stays fixed. Real bodies bend a little, but for many problems this model works well.
- **Pure translation:** every particle has the same velocity at any instant. A block sliding down a slope.
- **Rotation about a fixed axis:** every particle moves in a **circle**. Each circle lies in a plane perpendicular to the axis, with its centre on the axis. Particles on the axis stay at rest. A ceiling fan, a door, a potter's wheel.
- **Rotation about an axis that is not fixed:** a spinning top whose axis sweeps round a cone (precession). In this chapter, the axis is fixed unless stated.
- **General motion** = translation + rotation. A cylinder rolling down a slope does both.

## 2. Centre of mass (CM)

The **centre of mass** is the point that moves as if the whole mass of the system were there and all the external forces acted on it.

- Two particles: $X = \dfrac{m_1x_1 + m_2x_2}{m_1 + m_2}$. It lies on the line joining them, closer to the heavier one.
- Many particles: $\vec R = \dfrac{\sum m_i\vec r_i}{M}$. Work out $X$, $Y$, $Z$ one at a time.
- **Symmetry helps:** for a uniform rod, ring, disc, sphere, cylinder or cube, the CM is at the geometric centre.
- The CM **need not be inside the body**. For a ring it is at the centre, where there is no mass.
- **Compound bodies:** replace each part by a point mass at its own CM, then combine. For a body with a hole (NCERT Exercise 6.15), treat the hole as a **negative mass**.

:::example{title="L-shaped plate"}
Three identical uniform squares of side 1 m, each of mass 1 kg, make an L: squares at (0, 0)–(1, 1), (1, 0)–(2, 1) and (0, 1)–(1, 2). Their centres are (0.5, 0.5), (1.5, 0.5) and (0.5, 1.5).

$X = \dfrac{0.5 + 1.5 + 0.5}{3} = \dfrac56$ m and, the same way, $Y = \dfrac56$ m. The CM lies on the line of symmetry $y = x$, as it must.
:::

## 3. Motion of the centre of mass

- $M\vec A = \vec F_{ext}$. The internal forces cancel in pairs (Newton's third law), so **only external forces** can change the motion of the CM.
- **Exploding shell:** a shell bursts in mid-air. The explosion forces are internal, so the CM keeps moving on the **same parabola**, as long as only gravity acts.
- **Decay of a nucleus at rest:** the CM stays at rest. The two pieces fly off in opposite directions with equal and opposite momenta.
- Because of this, we can treat the CM's motion (translation) and the motion **about** the CM (rotation) separately.

## 4. Linear momentum of a system

- Total momentum $\vec P = \sum m_i\vec v_i = M\vec V$.
- $\dfrac{d\vec P}{dt} = \vec F_{ext}$.
- **Conservation:** if the total external force is zero, $\vec P$ is constant and the CM moves with **constant velocity** (or stays at rest). The parts can still move in complicated ways.

## 5. Vector product

- $\vec c = \vec a\times\vec b$ has magnitude $ab\sin\theta$ and is perpendicular to the plane of $\vec a$ and $\vec b$.
- **Right-hand rule:** curl the fingers of the right hand from $\vec a$ to $\vec b$ (through the smaller angle). The thumb gives the direction of $\vec c$.
- **Not commutative:** $\vec a\times\vec b = -\vec b\times\vec a$. It is distributive.
- Parallel or antiparallel vectors give $\vec 0$. In particular $\hat i\times\hat i = \vec 0$.
- Cyclic order gives $+$: $\hat i\times\hat j = \hat k$, $\hat j\times\hat k = \hat i$, $\hat k\times\hat i = \hat j$.

## 6. Angular velocity and angular acceleration

- For rotation about a fixed axis, every particle turns through the same angle in the same time. So all particles share **one** angular velocity $\omega$.
- Linear speed depends on the distance from the axis: $v = \omega r_\perp$. Particles farther out move faster.
- $\vec v = \vec\omega\times\vec r$, where $\vec r$ is measured from any point on the axis.
- $\vec\omega$ points **along the axis**, by the right-hand rule. For a fixed axis its direction does not change, so we can treat $\omega$ as a number with a sign.
- **Angular acceleration** $\vec\alpha = d\vec\omega/dt$.

## 7. Torque and angular momentum

- **Torque** $\vec\tau = \vec r\times\vec F$ is the turning effect of a force. It depends on the force, the point where it acts, and the point (origin) we take moments about.
- $\tau = r_\perp F$: a force does more turning when its line is farther from the point. A force whose line passes **through** the point gives zero torque.
- **Angular momentum** $\vec l = \vec r\times\vec p$ is the "rotational momentum" of a particle.
- $d\vec l/dt = \vec\tau$, the rotational form of $d\vec p/dt = \vec F$.
- For a system, the internal torques cancel (taking internal forces along the line joining the particles). So $d\vec L/dt = \vec\tau_{ext}$.
- **Conservation:** if $\vec\tau_{ext} = 0$, the total angular momentum $\vec L$ is constant.

:::remember
A particle moving in a straight line at constant velocity has **constant** angular momentum about any fixed point: $l = mvr_\perp$, and $r_\perp$ (the distance of the line from the point) does not change.
:::

## 8. Equilibrium of a rigid body

- **Translational equilibrium:** $\sum\vec F_{ext} = \vec 0$, so the linear momentum doesn't change.
- **Rotational equilibrium:** $\sum\vec\tau_{ext} = \vec 0$, so the angular momentum doesn't change.
- A **couple** (equal, opposite forces with different lines of action) has zero net force but non-zero torque. It only rotates the body. Opening a bottle cap or turning a steering wheel uses a couple.
- **Principle of moments:** for a lever in equilibrium, load × load arm = effort × effort arm. Mechanical advantage = load / effort = effort arm / load arm. If the effort arm is longer, M.A. > 1 (a crowbar).
- **Centre of gravity (CG):** the point about which the total gravitational torque on the body is zero. A body supported at its CG balances.
- If $g$ is the same at every part of the body, the CG and CM are the **same point**. For a very large body (a mountain), $g$ varies, and they differ.

## 9. Moment of inertia

- $I = \sum m_ir_i^2$, with $r_i$ measured from the axis. It plays the role of **mass** in rotation: a larger $I$ means it is harder to start or stop the rotation.
- $I$ depends on the **mass**, on **how the mass is spread** around the axis, and on **which axis** is chosen. A body has different $I$ about different axes.
- Mass far from the axis adds much more ($r^2$). About the same axis, a ring has a larger $I$ than a disc of the same mass and radius.
- **Radius of gyration** $k$: $I = Mk^2$. A ring has $k = R$; a disc about its axis has $k = R/\sqrt2$.
- **Flywheel:** a heavy wheel with large $I$, used in engines. It resists sudden changes in speed and gives a smooth ride.
- Rotational kinetic energy: $K = \tfrac12 I\omega^2$.

## 10. Rotation about a fixed axis

**Kinematics.** With constant $\alpha$, the equations look exactly like straight-line motion: $\theta \to x$, $\omega \to v$, $\alpha \to a$.

**Dynamics.** Only the torque component **along the axis** turns the body; the other parts are balanced by the axle. Then:
- $\tau = I\alpha$ (rotational form of $F = ma$);
- work $dW = \tau\,d\theta$, and power $P = \tau\omega$ (like $P = Fv$);
- work done by the torque = change in rotational kinetic energy.

| Linear motion | Rotation about a fixed axis |
| --- | --- |
| $x$, $v$, $a$ | $\theta$, $\omega$, $\alpha$ |
| Mass $M$ | Moment of inertia $I$ |
| $F = Ma$ | $\tau = I\alpha$ |
| $p = Mv$ | $L = I\omega$ |
| $K = \tfrac12 Mv^2$ | $K = \tfrac12 I\omega^2$ |
| $W = \int F\,dx$ | $W = \int\tau\,d\theta$ |
| $P = Fv$ | $P = \tau\omega$ |

## 11. Conservation of angular momentum (fixed axis)

- $L = I\omega$ (the component along the axis) and $dL/dt = \tau_{ext}$. If $\tau_{ext} = 0$: $I\omega$ = constant.
- **Make $I$ smaller and $\omega$ goes up.** A skater or a ballet dancer pulls the arms in to spin faster. A diver tucks in to do more somersaults. A person on a swivel chair spins faster when pulling heavy weights towards the body.
- When $I$ falls, $K = \dfrac{L^2}{2I}$ **rises**. The extra energy comes from the work done by the person's muscles.

## 12. Exam extras (not in the current NCERT book)

The rationalised NCERT dropped these sections, but exams still ask them.

**Theorem of parallel axes:** $I = I_{cm} + Md^2$ for any body. Of all axes in one direction, the one through the CM has the least $I$.

**Theorem of perpendicular axes:** $I_z = I_x + I_y$, for **flat** (laminar) bodies only. For a disc: $I_{diameter} = \tfrac12 I_{axis} = \tfrac14 MR^2$.

**Rolling without slipping:**
- $v_{cm} = R\omega$. The contact point is at rest at that instant (NCERT mentions this in §6.1); the top moves at $2v_{cm}$.
- $K = \tfrac12 Mv_{cm}^2 + \tfrac12 I_{cm}\omega^2$ (translation + rotation).
- Static friction makes the body roll, but in pure rolling it does **no work**. So mechanical energy is conserved (rolling friction and air drag ignored).
- Rolling down a slope from rest, the body with the smaller $k^2/R^2$ is faster: solid sphere, then disc, then hollow sphere, then ring.
