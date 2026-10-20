---
title: "Laws of Motion: Short Notes"
type: short_notes
chapter: c11.physics.laws-of-motion
order: 2
---

## 1. Aristotle's fallacy and the law of inertia

- **Aristotle** thought a force is needed to keep a body moving. This is wrong.
- A moving body on Earth stops because of **friction and air resistance**, which are external forces.
- **Galileo** used a double inclined plane. On smooth planes a ball rolling down one plane climbs the other to nearly its starting height (never higher). Make the second plane less steep and the ball rolls farther to reach that height. Make it horizontal and the ball would go on for ever (the ideal, frictionless case).
- Conclusion: the state of rest and the state of uniform straight-line motion are equivalent. No net force is needed to keep a body moving uniformly.

:::remember
**Inertia** is the resistance of a body to any change in its state of rest or uniform motion. **Mass** is the measure of inertia.
:::

## 2. Newton's first law

"Every body continues to be in its state of rest or of uniform motion in a straight line unless compelled by some external force to act otherwise."

- Zero net external force means zero acceleration, and the converse.
- Examples: passengers fall back when a bus starts suddenly, and forward when it stops. Seat belts protect them.
- A book on a table: we **see** it at rest, so the first law says the net force is zero, so the normal force $R$ must equal its weight $W$. NCERT warns against the reverse reasoning ("$W = R$, so the book is at rest").
- (Exam extra, not in NCERT) A frame in which the first law holds is called an **inertial frame**. A frame accelerating relative to it is non-inertial.

## 3. Momentum and Newton's second law

**Momentum** $\vec p = m\vec v$ (vector, kg m/s). Everyday facts:
- A heavy truck needs more force than a light car to stop in the same time, if both move at the same speed.
- A fast cricket ball needs more force to stop than a slow one.
- A cricketer **draws his hands back** while catching. This makes the stopping time longer, so the force is smaller.

**Second law:** the rate of change of momentum is proportional to the net force and is in its direction. With SI units:
$$\vec F = \frac{d\vec p}{dt}$$
$$\vec F = m\vec a \;\text{(constant } m)$$

- It agrees with the first law: $\vec F = 0$ gives $\vec a = 0$.
- It is a **vector** law: it holds for each component separately. A force perpendicular to the velocity changes only its direction.
- It is a **local** law: the force at a point at an instant gives the acceleration at that point at that instant. Acceleration does not depend on past motion.
- Only **external** forces count. Internal forces of a system cancel.

## 4. Impulse

A large force acting for a very short time (bat on ball, hammer on nail) is an **impulsive force**. Measuring it and the time is hard, but their product is easy:
$$\text{Impulse} = F\,\Delta t$$
$$\text{Impulse} = \Delta p$$
Here $F$ is the (average) force over the short time $\Delta t$. The body hardly moves while the force acts.

:::example{title="Ball rebounding off a wall"}
A 0.15 kg ball hits a wall at 12 m/s and comes straight back at 12 m/s. $\Delta p = 0.15 \times (12 + 12) = 3.6$ N s, directed away from the wall. (Speeds add because the direction reverses.)
:::

## 5. Newton's third law

"To every action, there is always an equal and opposite reaction."

- Forces always come in **pairs**. There is no single, isolated force.
- Action and reaction act on **different bodies**, so they never cancel each other.
- They act at the **same instant**. Calling one "action" and the other "reaction" says nothing about cause and effect.
- Both forces are of the same kind (both gravitational, both contact, and so on).
- Examples: walking (foot pushes ground back, ground pushes foot forward), a gun's recoil, a rocket (pushes gas back, gas pushes rocket forward).

## 6. Conservation of momentum

"The total momentum of an isolated system of interacting particles is conserved."

It follows from the second and third laws. Inside the system, each pair of forces is equal and opposite and acts for the same time, so the impulses cancel.

- **Gun and bullet:** total momentum is zero before firing, so it stays zero. The gun recoils backward with $V = -mv/M$.
- **Collisions:** total momentum before = total momentum after, as long as no external force acts during the collision.

## 7. Equilibrium of a particle

A particle is in equilibrium when the **net external force is zero**. It is then at rest or moving with constant velocity.

| Forces | Condition |
| --- | --- |
| Two forces | Equal in size, opposite in direction |
| Three forces | Their vector sum is zero; they form a closed triangle |
| Many forces | $\sum F_x = \sum F_y = \sum F_z = 0$ |

## 8. Common forces in mechanics

- **Gravitational force** acts at a distance. For uncharged, non-magnetic bodies, every other force in mechanics is a **contact force** (NCERT). Contact forces come, at the atomic level, from electrical forces.
- **Normal reaction** $N$: the part of a contact force perpendicular to the surfaces.
- **Friction**: the part of a contact force parallel to the surfaces. It opposes **relative** motion (or the start of it).
- **Tension**: the pull in a string. In a light (massless) string, it is the same all along. Over a pulley it stays the same only if the pulley is light and frictionless.
- **Spring force**: $F = -kx$ (restoring, towards the natural length). Hooke's law is used fully in later chapters.

## 9. Friction

| Type | When | Size |
| --- | --- | --- |
| Static | No sliding yet | $0 \le f_s \le \mu_s N$ |
| Kinetic | Surfaces sliding | $f_k = \mu_k N$ |
| Rolling | One body rolls on another | Much smaller than both |

- Static friction is **self-adjusting**: it takes whatever value (up to $\mu_s N$) stops sliding. With just a horizontal push on a level floor, it is equal and opposite to the push until the push reaches $\mu_s N$.
- $\mu_s$ and $\mu_k$ depend on the pair of surfaces. They do **not** depend on the area of contact.
- $\mu_k < \mu_s$ (NCERT: found by experiment): it is easier to keep a body sliding than to start it.
- Friction is useful: walking, car tyres, brakes. It also wastes energy as heat. To reduce it: lubricants, ball bearings, a cushion of air.

:::remember
Rolling friction is much smaller than sliding friction. That is why wheels and ball bearings are used.
:::

## 10. Circular motion

A body moving in a circle needs a net force towards the centre: $f_c = mv^2/r$.

| Case | What gives $f_c$ |
| --- | --- |
| Stone whirled on a string | Tension |
| Car on a level road | Static friction |
| Car on a banked road | Part of the normal force (plus friction) |
| Moon round the Earth | Gravity |

**Level road:** static friction $\mu_s N = \mu_s mg$ is the most it can give, so $v_{max} = \sqrt{\mu_s r g}$.

**Banked road** (outer edge raised by angle $\theta$): the horizontal part of $N$ supplies some or all of $f_c$. This reduces the need for friction. At $v_o = \sqrt{r g\tan\theta}$ no friction is needed, so there is less wear on the tyres.

:::example{title="Level road"}
A curve of radius 50 m, $\mu_s = 0.8$, $g = 10$ m/s². $v_{max} = \sqrt{0.8 \times 50 \times 10} = 20$ m/s (72 km/h).
:::

## 11. Solving problems in mechanics (NCERT method)

1. Draw a rough diagram of the whole system.
2. Pick **one** body (or part). Draw its **free-body diagram**: every force **on** it, none of the forces it exerts on others.
3. Mark known forces. Put unknowns (tension, normal force, friction) as symbols.
4. Apply $\vec F = m\vec a$ along suitable axes (often along and perpendicular to an incline).
5. If needed, repeat for another body. Use the third law to link the forces between them.
