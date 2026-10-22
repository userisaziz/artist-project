"""Catalog areas: the neighbourhoods of each operating city (BTM Layout, Koramangala, …) with a rough centre,
so artists place their studio in a named area and a map pin snaps to the nearest one.

The centres are approximate (to within about a kilometre) and should be checked locally before launch.

Revision ID: 3a6c8e1f5d27
Revises: 5b8d2f4a7c19
Create Date: 2026-10-22
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "3a6c8e1f5d27"
down_revision: str | Sequence[str] | None = "5b8d2f4a7c19"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# (name, latitude, longitude) per city; city names match CatalogSettings.cities.
AREAS: dict[str, list[tuple[str, float, float]]] = {
    "Bangalore": [
        ("Banashankari", 12.9255, 77.5468),
        ("Banaswadi", 13.0141, 77.6518),
        ("Bannerghatta Road", 12.8880, 77.5970),
        ("Basavanagudi", 12.9406, 77.5738),
        ("Basaveshwaranagar", 12.9934, 77.5395),
        ("Bellandur", 12.9304, 77.6784),
        ("Brookefield", 12.9655, 77.7185),
        ("BTM Layout", 12.9166, 77.6101),
        ("Domlur", 12.9610, 77.6387),
        ("Electronic City", 12.8452, 77.6602),
        ("Frazer Town", 12.9967, 77.6150),
        ("Hebbal", 13.0358, 77.5970),
        ("Hennur", 13.0358, 77.6434),
        ("HSR Layout", 12.9116, 77.6474),
        ("Indiranagar", 12.9784, 77.6408),
        ("Jayanagar", 12.9250, 77.5938),
        ("JP Nagar", 12.9077, 77.5851),
        ("Kalyan Nagar", 13.0280, 77.6400),
        ("Kammanahalli", 13.0159, 77.6379),
        ("Kengeri", 12.9177, 77.4838),
        ("Koramangala", 12.9352, 77.6245),
        ("KR Puram", 13.0076, 77.6950),
        ("Malleshwaram", 13.0031, 77.5643),
        ("Marathahalli", 12.9569, 77.7011),
        ("MG Road", 12.9750, 77.6060),
        ("Rajajinagar", 12.9915, 77.5554),
        ("Richmond Town", 12.9637, 77.6010),
        ("RT Nagar", 13.0213, 77.5951),
        ("Sadashivanagar", 13.0068, 77.5813),
        ("Sarjapur Road", 12.9081, 77.6866),
        ("Ulsoor", 12.9817, 77.6286),
        ("Vijayanagar", 12.9719, 77.5371),
        ("Whitefield", 12.9698, 77.7500),
        ("Yelahanka", 13.1005, 77.5963),
        ("Yeshwanthpur", 13.0285, 77.5410),
    ],
    "Mumbai": [
        ("Andheri East", 19.1155, 72.8723),
        ("Andheri West", 19.1364, 72.8296),
        ("Bandra West", 19.0596, 72.8295),
        ("Borivali", 19.2307, 72.8567),
        ("Chembur", 19.0522, 72.9005),
        ("Colaba", 18.9067, 72.8147),
        ("Dadar", 19.0178, 72.8478),
        ("Ghatkopar", 19.0860, 72.9081),
        ("Goregaon", 19.1663, 72.8526),
        ("Juhu", 19.1075, 72.8263),
        ("Kandivali", 19.2045, 72.8376),
        ("Khar", 19.0726, 72.8370),
        ("Kharghar", 19.0473, 73.0699),
        ("Lower Parel", 18.9953, 72.8302),
        ("Malad", 19.1874, 72.8484),
        ("Mulund", 19.1726, 72.9425),
        ("Powai", 19.1176, 72.9060),
        ("Santacruz", 19.0843, 72.8360),
        ("Thane West", 19.2183, 72.9781),
        ("Vashi", 19.0771, 72.9986),
        ("Vile Parle", 19.0990, 72.8440),
        ("Worli", 19.0176, 72.8150),
    ],
    "Delhi NCR": [
        ("Connaught Place", 28.6315, 77.2167),
        ("DLF Cyber City", 28.4950, 77.0895),
        ("Dwarka", 28.5921, 77.0460),
        ("Golf Course Road", 28.4530, 77.1000),
        ("Greater Kailash", 28.5482, 77.2380),
        ("Hauz Khas", 28.5494, 77.2001),
        ("Indirapuram", 28.6460, 77.3695),
        ("Janakpuri", 28.6219, 77.0878),
        ("Karol Bagh", 28.6519, 77.1909),
        ("Lajpat Nagar", 28.5677, 77.2433),
        ("Mayur Vihar", 28.6043, 77.2944),
        ("Noida Sector 18", 28.5708, 77.3260),
        ("Noida Sector 62", 28.6270, 77.3650),
        ("Pitampura", 28.7033, 77.1310),
        ("Preet Vihar", 28.6417, 77.2953),
        ("Punjabi Bagh", 28.6683, 77.1325),
        ("Rajouri Garden", 28.6415, 77.1209),
        ("Rohini", 28.7495, 77.0565),
        ("Saket", 28.5245, 77.2066),
        ("Sohna Road", 28.4200, 77.0400),
        ("South Extension", 28.5687, 77.2209),
        ("Sushant Lok", 28.4640, 77.0790),
        ("Vasant Kunj", 28.5200, 77.1590),
    ],
    "Hyderabad": [
        ("Ameerpet", 17.4375, 78.4482),
        ("Banjara Hills", 17.4156, 78.4347),
        ("Begumpet", 17.4447, 78.4664),
        ("Dilsukhnagar", 17.3688, 78.5247),
        ("Gachibowli", 17.4401, 78.3489),
        ("Himayatnagar", 17.4010, 78.4840),
        ("Hitech City", 17.4435, 78.3772),
        ("Jubilee Hills", 17.4325, 78.4073),
        ("Kompally", 17.5360, 78.4870),
        ("Kondapur", 17.4690, 78.3640),
        ("Kukatpally", 17.4948, 78.3996),
        ("LB Nagar", 17.3457, 78.5522),
        ("Madhapur", 17.4483, 78.3915),
        ("Manikonda", 17.4040, 78.3870),
        ("Mehdipatnam", 17.3950, 78.4380),
        ("Miyapur", 17.4968, 78.3614),
        ("Secunderabad", 17.4399, 78.4983),
        ("Somajiguda", 17.4239, 78.4590),
        ("Tolichowki", 17.4000, 78.4140),
        ("Uppal", 17.4058, 78.5591),
    ],
    "Chennai": [
        ("Adyar", 13.0012, 80.2565),
        ("Anna Nagar", 13.0850, 80.2101),
        ("Ashok Nagar", 13.0350, 80.2120),
        ("Besant Nagar", 13.0003, 80.2667),
        ("Chromepet", 12.9516, 80.1462),
        ("Kilpauk", 13.0827, 80.2414),
        ("KK Nagar", 13.0390, 80.1990),
        ("Kodambakkam", 13.0521, 80.2255),
        ("Medavakkam", 12.9171, 80.1923),
        ("Mylapore", 13.0339, 80.2619),
        ("Nungambakkam", 13.0569, 80.2425),
        ("Perambur", 13.1210, 80.2329),
        ("Porur", 13.0382, 80.1565),
        ("Royapettah", 13.0540, 80.2640),
        ("Sholinganallur", 12.9010, 80.2279),
        ("T Nagar", 13.0418, 80.2341),
        ("Tambaram", 12.9249, 80.1000),
        ("Thoraipakkam", 12.9416, 80.2362),
        ("Vadapalani", 13.0500, 80.2121),
        ("Velachery", 12.9815, 80.2180),
    ],
    "Pune": [
        ("Aundh", 18.5590, 73.8078),
        ("Baner", 18.5590, 73.7868),
        ("Bavdhan", 18.5130, 73.7820),
        ("Camp", 18.5150, 73.8780),
        ("Deccan Gymkhana", 18.5167, 73.8411),
        ("Hadapsar", 18.5089, 73.9260),
        ("Hinjewadi", 18.5913, 73.7389),
        ("Kalyani Nagar", 18.5463, 73.9033),
        ("Kharadi", 18.5515, 73.9348),
        ("Kondhwa", 18.4672, 73.8900),
        ("Koregaon Park", 18.5362, 73.8940),
        ("Kothrud", 18.5074, 73.8077),
        ("Magarpatta", 18.5146, 73.9270),
        ("NIBM Road", 18.4766, 73.9060),
        ("Pimple Saudagar", 18.5990, 73.7990),
        ("Pimpri", 18.6298, 73.7997),
        ("Shivajinagar", 18.5308, 73.8475),
        ("Sinhagad Road", 18.4800, 73.8200),
        ("Undri", 18.4560, 73.9050),
        ("Viman Nagar", 18.5679, 73.9143),
        ("Wagholi", 18.5808, 73.9787),
        ("Wakad", 18.5989, 73.7650),
        ("Warje", 18.4844, 73.8000),
    ],
}


def upgrade() -> None:
    area = op.create_table(
        "catalog_area",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("city", sa.String(length=60), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_catalog_area"),
        sa.UniqueConstraint("city", "name", name="uq_catalog_area_city"),
    )
    op.create_index("ix_catalog_area_city", "catalog_area", ["city"])
    op.bulk_insert(
        area,
        [
            {"city": city, "name": name, "latitude": lat, "longitude": lng}
            for city, rows in AREAS.items()
            for name, lat, lng in rows
        ],
    )


def downgrade() -> None:
    op.drop_index("ix_catalog_area_city", table_name="catalog_area")
    op.drop_table("catalog_area")
