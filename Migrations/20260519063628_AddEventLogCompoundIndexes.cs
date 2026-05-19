using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace api.Migrations
{
    /// <inheritdoc />
    public partial class AddEventLogCompoundIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_event_logs_Endpoint",
                table: "event_logs");

            migrationBuilder.DropIndex(
                name: "IX_event_logs_EventType",
                table: "event_logs");

            migrationBuilder.DropIndex(
                name: "IX_event_logs_Level",
                table: "event_logs");

            migrationBuilder.DropIndex(
                name: "IX_event_logs_Timestamp",
                table: "event_logs");

            migrationBuilder.CreateIndex(
                name: "IX_event_logs_Endpoint_Timestamp",
                table: "event_logs",
                columns: new[] { "Endpoint", "Timestamp" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "IX_event_logs_EventType_Timestamp",
                table: "event_logs",
                columns: new[] { "EventType", "Timestamp" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "IX_event_logs_Level_Timestamp",
                table: "event_logs",
                columns: new[] { "Level", "Timestamp" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "IX_event_logs_Timestamp",
                table: "event_logs",
                column: "Timestamp",
                descending: new bool[0]);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_event_logs_Endpoint_Timestamp",
                table: "event_logs");

            migrationBuilder.DropIndex(
                name: "IX_event_logs_EventType_Timestamp",
                table: "event_logs");

            migrationBuilder.DropIndex(
                name: "IX_event_logs_Level_Timestamp",
                table: "event_logs");

            migrationBuilder.DropIndex(
                name: "IX_event_logs_Timestamp",
                table: "event_logs");

            migrationBuilder.CreateIndex(
                name: "IX_event_logs_Endpoint",
                table: "event_logs",
                column: "Endpoint");

            migrationBuilder.CreateIndex(
                name: "IX_event_logs_EventType",
                table: "event_logs",
                column: "EventType");

            migrationBuilder.CreateIndex(
                name: "IX_event_logs_Level",
                table: "event_logs",
                column: "Level");

            migrationBuilder.CreateIndex(
                name: "IX_event_logs_Timestamp",
                table: "event_logs",
                column: "Timestamp");
        }
    }
}
