Hello World# 🌍 Tara G!

**Tara G!** is a collaborative **travel management web app** that helps travelers plan, organize, and share their trips.  
Users can create detailed itineraries, add stops and activities, estimate expenses, manage shared budgets, upload trip photos or videos, and even make their trips public for others to join or reuse.

---

## ✈️ Overview

Tara G! makes trip planning social and flexible.  
Whether you’re a solo traveler or organizing a barkada getaway, this app keeps everything in one place — from your destinations and travel dates to your pooled expenses and shared memories.

Key features include:
- 📍 **Trip Itineraries** – Create trips with detailed stops, routes, and schedules.  
- 💸 **Budget Management** – Track estimated vs. actual costs, divided among members.  
- 👥 **Group Trips** – Invite travel buddies, manage a shared cash pool, and split expenses automatically.  
- 📸 **Trip Media Album** – Upload and view photos/videos for each trip.  
- 🌐 **Public Trips** – Make trips visible to the community, allow others to join or reuse itineraries.  
- 💬 **Reviews & Comments** – Travelers can leave reviews or suggestions for shared trips.  

---

## 🧩 Core Domains

### **Users**
Stores account credentials and personal information.
- User profiles  
- Credentials (auth)  
- Contact & preferences  

### **Trips**
Main entity containing all trip details.  
Includes metadata such as trip type (private/public), max participants, total cost, and trip owner.

### **Stops & Itinerary Items**
- **Stops** represent major locations or milestones (e.g., Cebu City → Bohol).  
- **Itinerary Items** detail the activities, notes, or expenses under each stop.  

### **Expenses**
Tracks individual and group expenses.  
Supports:
- Estimated and actual cost  
- Expense categories (fuel, food, lodging, etc.)  
- Automatic cost-splitting among members  

### **Group Members & Pool**
Handles users in a shared trip.  
- Cash pool contributions  
- Reimbursements and balance summaries  

### **Trip Media**
Stores uploaded images or videos for each trip.  
(Planned integration with **Cloudflare R2** for storage.)  

### **Trip Reviews & Comments**
Unified system for:
- Trip ratings and feedback  
- Threaded comments or suggestions from reusers  

---

## ⚙️ Tech Stack (Planned)

| Layer | Technology |
|-------|-------------|
| Frontend | **NextJS + TailwindCSS** |
| Backend | **Golang GoFiber** |
| Database | **PostgreSQL (Supabase)** |
| Auth | **JWT or Session-based Authentication** |
| Media Storage | **Cloudflare R2** |
| Deployment | **Cloudflare Pages / Workers** |

---

## 🚧 Future Enhancements

- Trip analytics dashboard (cost breakdown, route map visualization)  
- Location and route suggestions via map APIs  
- Offline mode or export to PDF itinerary  
- Advanced privacy controls for trips  
- Real-time group chat or trip discussion board  

---

## 💡 Project Vision

> “Tara G!” aims to make travel planning collaborative, transparent, and fun —  
> turning the hassle of coordinating trips into a shared adventure.

---

## 📜 License

MIT License  
© 2025 Jan Dave Zamora. All rights reserved.
