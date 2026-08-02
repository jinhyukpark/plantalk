package com.unb.repository;

import com.unb.entity.Friendship;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FriendshipRepository extends JpaRepository<Friendship, UUID> {
    Optional<Friendship> findByUserOneIdAndUserTwoId(UUID userOneId, UUID userTwoId);

    @Query("select f from Friendship f where (f.userOneId = :userId or f.userTwoId = :userId) and f.status = :status order by f.updatedAt desc")
    List<Friendship> findForUserByStatus(@Param("userId") UUID userId, @Param("status") Friendship.Status status);

    @Query("select f from Friendship f order by f.updatedAt desc")
    List<Friendship> findAllRecent();

    @Query("select count(f) from Friendship f where f.requestedBy = :userId and f.status = com.unb.entity.Friendship.Status.ACCEPTED")
    long countFollowing(@Param("userId") UUID userId);

    @Query("""
        select count(f) from Friendship f
        where (f.userOneId = :userId or f.userTwoId = :userId)
          and f.requestedBy <> :userId
          and f.status = com.unb.entity.Friendship.Status.ACCEPTED
        """)
    long countFollowers(@Param("userId") UUID userId);
}
