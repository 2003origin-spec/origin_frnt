---
title: "Surface Areas and Volumes: Short Notes"
type: short_notes
chapter: c10.mathematics.surface-areas-and-volumes
order: 2
---

## 1. What this chapter is about

- You already know the basic solids: **cuboid, cube, cylinder, cone, sphere and hemisphere**.
- Many real objects are made by joining two of them. Examples from the book: an oil tanker (a cylinder with two hemispheres), a test tube (a cylinder and a hemisphere), a playing top (a cone and a hemisphere).
- This chapter teaches how to find the **surface area** and the **volume** of such combined solids.
- The current (rationalised) book has only these two topics. "Conversion of one solid into another" (melting and recasting) and the "frustum of a cone" were **removed**.

## 2. Basic solids: quick recap

| Solid | Curved / lateral | Total |
|---|---|---|
| Cylinder | $2\pi rh$ | $2\pi r(r + h)$ |
| Cone | $\pi rl$ | $\pi r(l + r)$ |
| Sphere | $4\pi r^2$ | $4\pi r^2$ |
| Hemisphere | $2\pi r^2$ | $3\pi r^2$ |

Volumes: cylinder $\pi r^2 h$, cone $\frac13\pi r^2 h$, sphere $\frac43\pi r^3$, hemisphere $\frac23\pi r^3$.

For a cone, the slant height is $l = \sqrt{r^2 + h^2}$.

## 3. Surface area of a combination

- Break the object into the basic solids you know.
- When two solids are joined, the faces that touch are **hidden**. They are not part of the outside surface.
- So the total surface area of the new solid is **not** the sum of the TSAs of the parts. Add only what you can see.

Steps:
1. Name the parts (cone, hemisphere, ...).
2. For each part, decide which surfaces are still on the outside.
3. Add those areas. Take out common factors like $\pi r$ before putting in numbers.

:::example{title="Top: cone on a hemisphere"}
Radius 6 cm, height of the cone 8 cm. So $l = \sqrt{36 + 64} = 10$ cm.

SA $= \pi r l + 2\pi r^2 = 60\pi + 72\pi = 132\pi$ cm².

The flat faces of the cone and the hemisphere are stuck together, so neither is counted.
:::

**When the flat faces are not the same size.** NCERT's toy rocket has a cone of radius 2.5 cm on a cylinder of radius 1.5 cm. The cone's base is bigger, so a **ring** of it still shows.

:::example{title="Rocket: the ring"}
Cone: $r = 5$, $h = 12$, so $l = 13$. Cylinder radius 3. All in cm.

Cone part to paint $= \pi r l + \pi(5)^2 - \pi(3)^2$

$= \pi(65 + 25 - 9) = 81\pi$ cm².
:::

**Cut-outs.** If a hemisphere is scooped out of a cube, you lose a circle ($\pi r^2$) on the top face but gain the inside of the bowl ($2\pi r^2$). The net change is $+\pi r^2$, the same as sticking a hemisphere **on** the cube.

Other book cases:
- **Bird-bath:** a cylinder with a hemispherical bowl at the top. SA $= 2\pi r h + 2\pi r^2$ (NCERT counts the side and the bowl only).
- **Vessel's inner surface:** hollow hemisphere + hollow cylinder, open at the top. Inner SA $= 2\pi r^2 + 2\pi r h$. Here $h$ is the height of the cylinder part = total height $- r$.
- **Tent:** canvas $= 2\pi r h + \pi r l$. The floor has no canvas.

## 4. Volume of a combination

- When two solids are **joined**, nothing disappears. The volume is the **sum** of the two volumes.
- When one solid is **cut out** of another, **subtract** its volume.

:::example{title="Ice-cream cone (π = 22/7)"}
A cone of radius 3.5 cm and height 12 cm is filled with ice cream, with a hemisphere of ice cream on top.

Cone $= \frac13 \times \frac{22}{7} \times 3.5^2 \times 12 = 154$ cm³.

Hemisphere $= \frac23 \times \frac{22}{7} \times 3.5^3 \approx 89.83$ cm³.

Total $\approx$ **243.83 cm³**.
:::

**Apparent and actual capacity.** NCERT's juice glass has a raised hemisphere inside its base. The glass looks like it holds $\pi r^2 h$, but it really holds $\pi r^2 h - \frac23\pi r^3$.

**Space left over.** The air in a shed = volume of the shed $-$ space taken by machines and people. Water left in a cylinder = volume of the cylinder $-$ volume of the solid placed in it.

**Circumscribing cylinder.** A cylinder that just fits around a toy has the toy's largest radius and the toy's full height. The space between them = cylinder $-$ toy.

## 5. Things dropped into water

- A solid put into a full vessel pushes out water equal to **its own volume** (if it sinks fully).
- Number of small solids = volume of water that must flow out $\div$ volume of one small solid.
- NCERT exercise: lead shots dropped into a cone full of water until one-fourth of the water flows out.

## 6. Good habits

- Write the formula in words first: "SA = CSA of cylinder + CSA of hemisphere".
- Change all lengths to one unit (cm or m) before you start.
- Keep $\pi$ as a letter until the last line, then put in $\frac{22}{7}$ or $3.14$.
- With $\frac{22}{7}$, radii like 7, 3.5, 14 and 21 make the 7 cancel easily.
- Write the unit: cm² for areas, cm³ for volumes.
