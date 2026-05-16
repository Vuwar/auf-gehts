using Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Week> Weeks => Set<Week>();
    public DbSet<WordSet> WordSets => Set<WordSet>();
    public DbSet<Word> Words => Set<Word>();
    public DbSet<UserSetProgress> UserSetProgress => Set<UserSetProgress>();
    public DbSet<WordCache> WordCache => Set<WordCache>();
    public DbSet<AiUsage> AiUsage => Set<AiUsage>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("users");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.Email).IsRequired();
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("now()");
            entity.Property(e => e.LastSeenAt).HasDefaultValueSql("now()");
        });

        modelBuilder.Entity<Week>(entity =>
        {
            entity.ToTable("weeks");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.Title).IsRequired();
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("now()");
            entity.HasIndex(e => e.Number).IsUnique();
        });

        modelBuilder.Entity<WordSet>(entity =>
        {
            entity.ToTable("word_sets");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.Name).IsRequired();
            entity.Property(e => e.Slug).IsRequired();
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("now()");
            entity.HasIndex(e => e.Slug).IsUnique();
            entity.HasIndex(e => e.WeekId);
            entity.HasIndex(e => e.OwnerUserId);
            entity.HasIndex(e => e.IsPublic);
            entity.HasOne(e => e.Week)
                  .WithMany(w => w.WordSets)
                  .HasForeignKey(e => e.WeekId)
                  .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne<User>()
                  .WithMany()
                  .HasForeignKey(e => e.OwnerUserId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Word>(entity =>
        {
            entity.ToTable("words");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.Front).IsRequired();
            entity.Property(e => e.Back).IsRequired();
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("now()");
            entity.HasIndex(e => e.WordSetId);
            entity.HasOne(e => e.WordSet)
                  .WithMany(s => s.Words)
                  .HasForeignKey(e => e.WordSetId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<UserSetProgress>(entity =>
        {
            entity.ToTable("user_set_progress");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.LastReviewedAt).HasDefaultValueSql("now()");
            entity.HasIndex(e => new { e.UserId, e.WordSetId }).IsUnique();
            entity.HasOne(e => e.WordSet)
                  .WithMany()
                  .HasForeignKey(e => e.WordSetId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<User>()
                  .WithMany()
                  .HasForeignKey(e => e.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AiUsage>(entity =>
        {
            entity.ToTable("ai_usage");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");
            entity.HasIndex(e => new { e.UserId, e.Date }).IsUnique();
        });

        modelBuilder.Entity<WordCache>(entity =>
        {
            entity.ToTable("word_cache");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.Word).IsRequired();
            entity.Property(e => e.PayloadJson).IsRequired();
            entity.Property(e => e.CachedAt).HasDefaultValueSql("now()");
            entity.HasIndex(e => e.Word).IsUnique();
        });
    }
}
