---
title: "Electromagnetic Induction: Short Notes"
type: short_notes
chapter: c12.physics.electromagnetic-induction
order: 2
---

## 1. What is electromagnetic induction?

Oersted and Ampere showed that moving charges (currents) make magnetic fields. Faraday (England) and Henry (USA), around 1830, showed the reverse: a **changing magnetic field** makes a current in a closed coil. Producing a current by a varying magnetic field is called **electromagnetic induction**. Generators and transformers work on it.

## 2. The experiments of Faraday and Henry

| Experiment | What is done | What the galvanometer shows |
| --- | --- | --- |
| 6.1 | Magnet moved towards or away from a coil | Deflection only while it moves |
| 6.2 | A current-carrying coil moved near the coil | Deflection only while it moves |
| 6.3 | Both coils fixed; key in the second coil pressed or released | A brief kick at press and at release, none while held |

- Pulling away gives the **opposite** deflection to pushing in. The S-pole gives the opposite deflection to the N-pole.
- Faster motion gives a **bigger** deflection.
- Moving the coil instead of the magnet gives the same result: only **relative motion** matters.
- Experiment 6.3 shows relative motion is not even needed. A changing current is enough.
- An iron rod inside the coils makes the deflection much bigger.

## 3. Magnetic flux

$$\Phi_B = \vec B\cdot\vec A = BA\cos\theta$$

- $\theta$ is the angle between $\vec B$ and the area vector (normal to the surface).
- Plane face-on to the field ($\theta = 0$): flux is maximum, $BA$. Plane along the field ($\theta = 90^\circ$): flux is zero.
- Unit: weber (Wb) = T m². Flux is a **scalar**.
- The flux can be changed by changing $B$, the area $A$ (shrinking or stretching the coil), or the angle $\theta$ (rotating the coil).

## 4. Faraday's law

The magnitude of the induced emf in a circuit equals the **time rate of change** of magnetic flux through it.
$$\varepsilon = -N\frac{d\Phi_B}{dt}$$

- In Experiment 6.3, pressing the key makes the current in coil C2 rise from zero, so the flux through C1 increases and an emf appears. With the key held, the flux is steady, so there is no emf.
- More turns $N$ give more emf.
- A steady field (such as the earth's field during an experiment) through a **fixed** loop gives **no** emf, however strong it is. If the loop moves, turns or changes shape in that steady field, its flux changes and an emf **does** appear (NCERT Example 6.3 turns a coil in the earth's field).

:::example{title="Field switched off"}
A loop of area 0.01 m² is held face-on to a 0.2 T field. The field falls steadily to zero in 0.1 s. $|\varepsilon| = \dfrac{0.2 \times 0.01}{0.1} = 0.02$ V $= 20$ mV.
:::

## 5. Lenz's law

**The polarity of the induced emf is such that it tends to produce a current which opposes the change in magnetic flux that produced it.** The minus sign in Faraday's law expresses this.

- N-pole pushed towards a coil: flux increases. The coil's induced current makes an **N-pole** on the side facing the magnet (anticlockwise as seen from the magnet's side), which repels it.
- N-pole pulled away: flux decreases. The coil makes an **S-pole** facing the magnet (clockwise as seen from the magnet's side), which attracts it.
- In an **open** circuit an emf still appears across the ends, but no current flows.

**Lenz's law and energy.** If the induced current helped the motion, a small push would make the magnet speed up for ever with no energy put in. That would be a perpetual-motion machine, which breaks conservation of energy. In fact the magnet is opposed, so you must do work to move it. That work appears as **Joule heat** in the coil.

## 6. Motional emf

A rod of length $l$ slides with speed $v$ on a U-shaped conductor in a uniform field $B$ perpendicular to the loop. The enclosed area changes, so the flux $Blx$ changes:
$$\varepsilon = Blv$$

**Same result from the Lorentz force.** Each free charge in the rod moves with the rod, so it feels a force $qvB$ along the rod. The work done moving it along the rod is $qvBl$, and emf = work per unit charge $= Blv$.

**Stationary conductor, changing field.** Here $\vec v = 0$, so the force on a charge must be $q\vec E$. So a time-varying magnetic field must **produce an electric field**. This field is different from the field of static charges.

**Rotating rod.** A rod of length $R$ turned at $\omega$ about one end, in a field parallel to the axis, has an emf $\tfrac12 B\omega R^2$ between its ends. Each bit $dr$ moves at $v = \omega r$, and $\int_0^R B\omega r\,dr = \tfrac12 B\omega R^2$.

## 7. Inductance

The flux through a coil is proportional to the current that makes it. The constant of proportionality between **flux linkage** $N\Phi_B$ and current is the **inductance**. Like capacitance, it depends only on the **geometry** of the coil and the **material** (permeability) inside, not on the current.

**Mutual inductance $M$.** A changing current in one coil induces an emf in a nearby coil:
$$\varepsilon_1 = -M\frac{dI_2}{dt}$$
- $M_{12} = M_{21}$ in general. This helps when one of them is hard to calculate directly.
- $M$ depends on the separation and the relative orientation of the coils. For the solenoid pair, filling the space with a material of relative permeability $\mu_r$ multiplies $M$ by $\mu_r$.
- For two long coaxial solenoids, $M = \mu_0 n_1 n_2 \pi r_1^2 l$, using the **inner** radius $r_1$, because only the inner cross-section is linked by both coils (the inner solenoid's field stays inside it).

**Self-inductance $L$.** A changing current in a coil induces an emf in the **same** coil:
$$\varepsilon = -L\frac{dI}{dt}$$
- This **back emf** opposes any change, increase or decrease, in the current.
- Long solenoid: $L = \mu_r\mu_0 n^2 A l$. A soft iron core (large $\mu_r$) raises $L$ a lot.

| Mechanics | Electricity |
| --- | --- |
| Mass $m$ | Self-inductance $L$ |
| Velocity $v$ | Current $I$ |
| $\tfrac12 mv^2$ | $\tfrac12 LI^2$ |

$L$ is **electrical inertia**: it opposes the growth and the decay of current.

**Energy.** Work done against the back emf while the current grows from 0 to $I$ is stored as magnetic energy $\tfrac12 LI^2$. For a solenoid this equals $\dfrac{B^2}{2\mu_0}\times$ (volume), so the energy density is $B^2/2\mu_0$. Like $\tfrac12\varepsilon_0E^2$ for the electric field, it holds for any region with a field.

## 8. AC generator

- **Principle:** a coil rotated in a magnetic field has a changing flux ($BA\cos\omega t$), because its effective area $A\cos\theta$ changes. It turns **mechanical energy into electrical energy**.
- **Parts:** the coil (**armature**) on a rotor shaft, its axis perpendicular to $\vec B$; **slip rings** and **brushes** connect the turning coil to the outside circuit.
- **Emf:** $\varepsilon = NBA\omega\sin\omega t$, peak $\varepsilon_0 = NBA\omega$. The polarity reverses every half turn, so the current is **alternating**.
- The emf is **greatest** when the plane of the coil is **parallel** to $\vec B$ ($\theta = 90^\circ$ or $270^\circ$, flux zero, changing fastest). It is **zero** when the plane is perpendicular to $\vec B$ (flux maximum).
- Energy sources: falling water (hydro-electric), steam from coal (thermal), steam from nuclear fuel (nuclear).
- In most real generators the coils stay still and the **electromagnets rotate**. Mains frequency: **50 Hz in India**, 60 Hz in the USA.
- Nikola Tesla is credited with developing the machine.

## 9. Extras (not in the current NCERT chapter)

**Eddy currents** (in both the JEE Main and NEET syllabi; removed from the current NCERT book). A changing flux through a solid piece of metal induces loops of current inside the metal itself. By Lenz's law they oppose the change, so they cause damping and heating.
- Reduced by **laminating** the iron cores of transformers and motors (thin insulated sheets).
- Used in **magnetic braking** of trains, **electromagnetic damping** of galvanometers, **induction furnaces** and electric power meters.
- A magnet dropped down a copper pipe falls slowly because of them.

**Sliding rod and energy** (exam extra: the force and power are not in the current NCERT book; the syllabi list induced emf and current). A rod on rails with total resistance $R$ carries $I = Blv/R$. The field then pulls back on it with $F = BIl = B^2l^2v/R$. To keep $v$ constant you must push with this force, and the power $Fv = B^2l^2v^2/R$ equals the Joule heat $I^2R$, as energy conservation demands.

**LR circuit** (beyond the syllabus: not in NCERT, and neither syllabus names it; a small aid only). When a battery is connected, the current does not jump to $\varepsilon/R$; it rises as $I_0(1 - e^{-Rt/L})$. The time constant $\tau = L/R$ is the time to reach about 63% of $I_0$.
