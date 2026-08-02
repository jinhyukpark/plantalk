package com.unb.repository;

import com.unb.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.time.LocalDateTime;

@Repository
public interface UserRepository extends JpaRepository<User, UUID>, JpaSpecificationExecutor<User> {
    Optional<User> findByNickname(String nickname);
    boolean existsByNickname(String nickname);
    List<User> findByEmail(String email);
    Page<User> findByIdNotOrderByCreatedAtDesc(UUID viewerId, Pageable pageable);

    @Query("SELECT u FROM User u WHERE (:viewerId IS NULL OR u.id <> :viewerId) " +
            "AND (:nationality IS NULL OR u.nationality = :nationality) " +
            "AND (:gender IS NULL OR u.gender = :gender) " +
            "AND (:minAge IS NULL OR u.age >= :minAge) AND (:maxAge IS NULL OR u.age <= :maxAge) " +
            "AND (:activeAfter IS NULL OR u.lastActiveAt >= :activeAfter) ORDER BY u.createdAt DESC")
    Page<User> discover(@Param("viewerId") UUID viewerId,
                        @Param("nationality") User.Nationality nationality,
                        @Param("gender") User.Gender gender,
                        @Param("minAge") Integer minAge,
                        @Param("maxAge") Integer maxAge,
                        @Param("activeAfter") LocalDateTime activeAfter,
                        Pageable pageable);
    
    @Query("SELECT u FROM User u WHERE LOWER(u.nickname) LIKE LOWER(CONCAT('%', :query, '%')) ORDER BY u.nickname")
    List<User> searchByNickname(@Param("query") String query);
}
