---
title: "Moving Charges and Magnetism: Short Notes"
type: short_notes
chapter: c12.physics.moving-charges-and-magnetism
order: 2
---

## 1. Oersted's discovery and the dot/cross convention

- In 1820, Oersted saw that a current in a straight wire **deflects a compass needle**. The needle sets along the tangent to a circle around the wire, in a plane perpendicular to the wire.
- Reversing the current reverses the needle. More current, or a nearer needle, gives more deflection.
- Conclusion: **moving charges (currents) produce a magnetic field.**

:::remember
NCERT convention: a dot ($\odot$) means a current or field coming **out of** the page (the tip of an arrow). A cross ($\otimes$) means going **into** the page (the tail feathers).
:::

## 2. Magnetic field and the Lorentz force

- A magnetic field $\vec B$ is a vector field, made by currents (moving charges) and by the intrinsic magnetic moments of particles. It obeys **superposition**: fields of several sources add as vectors.
- Force on a charge $q$ moving with $\vec v$: $\vec F = q(\vec E + \vec v \times \vec B)$, the **Lorentz force**.
- The magnetic part $q\,\vec v \times \vec B$:
  - depends on $q$, $\vec v$ and $\vec B$; it is opposite for a negative charge;
  - is perpendicular to both $\vec v$ and $\vec B$ (right-hand or screw rule);
  - is zero if $\vec v$ is parallel or antiparallel to $\vec B$, or if the charge is at rest.
- **Tesla:** $B$ is 1 T when a 1 C charge moving at 1 m/s perpendicular to $\vec B$ feels 1 N. The tesla is a large unit; 1 gauss $= 10^{-4}$ T.

## 3. Force on a current-carrying wire

The force on all the drifting carriers in a straight rod adds up to:
$$\vec F = I\,\vec l \times \vec B$$

- Current $I$ is **not a vector**. The direction is carried by $\vec l$, which points along the current.
- $\vec B$ is the **external** field. A wire does not push on itself.
- NCERT Example 4.1: a wire hangs in mid-air when $IlB = mg$. Only the mass per unit length matters.

## 4. Motion of a charge in a uniform magnetic field

The magnetic force is always perpendicular to the velocity, so it **does no work**. Speed and kinetic energy stay constant; only the direction changes.

| Case | Path |
| --- | --- |
| $\vec v \parallel \vec B$ | Straight line, no force |
| $\vec v \perp \vec B$ | Circle in a plane perpendicular to $\vec B$ |
| $\vec v$ at an angle | Helix along $\vec B$ |

For $\vec v \perp \vec B$, the magnetic force $qvB$ supplies the centripetal force $mv^2/r$:
$$r = \frac{mv}{qB}$$
$$\nu_c = \frac{qB}{2\pi m}$$

The **cyclotron frequency** $\nu_c$ does not depend on speed or radius. A faster particle moves on a bigger circle but takes the same time per turn. This is used in the cyclotron, a machine that speeds up charged particles (its working is not in the current NCERT book).

In a **helix**, $v_\parallel = v\cos\theta$ carries the particle along $\vec B$; $v_\perp = v\sin\theta$ makes the circle. The distance moved along $\vec B$ in one turn is the **pitch**, $p = v_\parallel T$.

:::example{title="NCERT Example 4.3"}
An electron at $3 \times 10^7$ m/s moves perpendicular to a field of $6 \times 10^{-4}$ T. Then $r = mv/qB \approx 28$ cm and $\nu = v/2\pi r \approx 17$ MHz.
:::

## 5. Biot-Savart law

The field of a small current element $I\,d\vec l$ at a point P at displacement $\vec r$ from it:
$$d\vec B = \frac{\mu_0}{4\pi}\,\frac{I\,d\vec l \times \vec r}{r^3}$$

- $\dfrac{\mu_0}{4\pi} = 10^{-7}$ T m/A. $\mu_0$ is the **permeability of free space**.
- $d\vec B$ is perpendicular to the plane of $d\vec l$ and $\vec r$.
- No field along the line of the element itself ($\sin\theta = 0$).

**Comparison with Coulomb's law**

| Point | Coulomb (electric) | Biot-Savart (magnetic) |
| --- | --- | --- |
| Distance | $1/r^2$, long range | $1/r^2$, long range |
| Source | Charge (scalar) | $I\,d\vec l$ (vector) |
| Direction | Along $\vec r$ | Perpendicular to $d\vec l$ and $\vec r$ |
| Angle | No angle factor | Has $\sin\theta$ |

Both obey superposition. Also $\varepsilon_0\mu_0 = 1/c^2$, so fixing one of $\varepsilon_0$, $\mu_0$ fixes the other.

## 6. Circular current loop

- By symmetry, the components of $d\vec B$ perpendicular to the axis cancel in pairs. Only the axial parts add.
- On the axis: $B = \dfrac{\mu_0 IR^2}{2(x^2 + R^2)^{3/2}}$. At the centre: $B = \dfrac{\mu_0 I}{2R}$.
- The field lines are closed loops. One face of the loop acts like a north pole, the other like a south pole.
- A semicircle gives half the field of a full loop at its centre. Straight leads whose line passes through the centre give nothing, because $d\vec l \times \vec r = 0$ for them.

:::remember
**Right-hand thumb rule for a loop:** curl the fingers of the right hand along the current. The thumb gives the direction of $\vec B$ at the centre (and of the magnetic moment).
:::

## 7. Ampere's circuital law

$$\oint \vec B \cdot d\vec l = \mu_0 I$$

- The line integral of $\vec B$ round any closed loop equals $\mu_0$ times the net current through it.
- Sign by the right-hand rule: fingers along the direction you go round, thumb shows the positive current.
- With enough symmetry, choose an **Amperian loop** on which $\vec B$ is tangential and constant (or normal, or zero). Then $BL = \mu_0 I_e$.
- Ampere's law is to Biot-Savart what Gauss's law is to Coulomb's law. It holds only for **steady** currents.

## 8. Straight wires

**Long thin wire:** a circle of radius $r$ round the wire gives $B \cdot 2\pi r = \mu_0 I$, so $B = \dfrac{\mu_0 I}{2\pi r}$.

- Field lines are concentric circles (cylindrical symmetry). This explains Oersted's iron filings.
- $B \propto 1/r$. It is finite at any non-zero distance even though the wire is infinite.

:::remember
**Right-hand rule for a wire:** grasp the wire with the thumb along the current. The fingers curl in the direction of $\vec B$.
:::

**Thick wire of radius $a$ with uniform current (NCERT Example 4.7):**
- inside ($r < a$): enclosed current is $I r^2/a^2$, so $B = \dfrac{\mu_0 I r}{2\pi a^2}$, rising linearly from zero at the axis;
- outside ($r > a$): $B = \dfrac{\mu_0 I}{2\pi r}$, as for a thin wire.

## 9. Solenoid

A long wire wound as a closely spaced helix, with length much larger than radius.

- The fields between neighbouring turns cancel. Inside, the field is strong, **uniform** and along the axis. Outside, it is nearly zero.
- A rectangular Amperian loop with one side (length $h$) inside gives $Bh = \mu_0 (nh) I$, so:
$$B = \mu_0 n I$$
- $n$ = turns per unit length. The field does not depend on the radius.
- A solenoid is the usual way to get a uniform field. A soft iron core makes it much stronger (next chapter).

## 10. Force between parallel currents and the ampere

Wire $a$ makes a field $B_a = \mu_0 I_a / 2\pi d$ at wire $b$. The force on a length $L$ of $b$ is $I_b L B_a$:
$$F = \frac{\mu_0 I_a I_b}{2\pi d}\,L$$

- **Parallel currents attract; antiparallel currents repel.** This is the opposite of charges (like charges repel).
- The forces on $a$ and $b$ are equal and opposite, as Newton's third law needs (for steady currents).

:::remember
**The ampere (NCERT definition):** the steady current which, in each of two very long, straight, parallel conductors of negligible cross-section placed 1 m apart in vacuum, produces a force of $2 \times 10^{-7}$ N per metre of length on each.

1 coulomb is the charge that flows in 1 s when the current is 1 A.
:::

## 11. Torque on a current loop; the magnetic dipole

- In a **uniform** field, a current loop feels **no net force** but does feel a **torque**, like an electric dipole in a uniform $\vec E$.
- Rectangular loop with $\vec B$ in its plane: the forces $IbB$ on two sides form a couple, $\tau = IAB$.
- In general $\tau = IAB\sin\theta$, with $\theta$ the angle between the normal and $\vec B$.
- With $\vec m = NI\vec A$: $\vec\tau = \vec m \times \vec B$. Unit of $m$: A m².

| Angle between $\vec m$ and $\vec B$ | Torque | Equilibrium |
| --- | --- | --- |
| $0^\circ$ | Zero | Stable |
| $90^\circ$ | Largest, $mB$ | Not in equilibrium |
| $180^\circ$ | Zero | Unstable |

- This torque is why a compass needle or any magnetic dipole lines up with the field.
- **Loop as a dipole:** far from a loop, its field has the same form as an electric dipole's field (replace $\vec p$ by $\vec m$ and $1/\varepsilon_0$ by $\mu_0$). Any planar loop is a magnetic dipole of moment $IA$.
- Difference: an electric dipole is made of two charges. A current loop is the most basic magnetic element; **magnetic monopoles are not known to exist**.

## 12. Moving coil galvanometer

- A coil of many turns turns about a fixed axis in a **radial** field. A cylindrical soft iron core makes the field radial and stronger.
- Radial field means the plane of the coil is always along $\vec B$, so the torque is always $NIAB$.
- A spring gives a restoring torque $k\phi$. At balance $k\phi = NIAB$, so $\phi \propto I$ and the scale is **linear**.
- **Current sensitivity** $\phi/I = NAB/k$. **Voltage sensitivity** $\phi/V = NAB/(kR_G)$.
- Doubling $N$ doubles current sensitivity, but also roughly doubles $R_G$, so voltage sensitivity stays the same.

**Why a galvanometer is not an ammeter:** it gives full-scale deflection for a current of the order of µA, and its resistance is large, so in series it would change the current.

| Conversion | What is added | Result |
| --- | --- | --- |
| Ammeter | Small shunt $r_s$ in **parallel** | Low resistance, about $r_s$ |
| Voltmeter | Large $R$ in **series** | High resistance, about $R$ |

As a detector (in a Wheatstone bridge) the pointer's zero is at the centre of the scale, so it can swing either way.
